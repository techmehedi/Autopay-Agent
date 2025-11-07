import { MCPClientCredentials } from '@locus-technologies/langchain-mcp-m2m';
import { ChatAnthropic } from '@langchain/anthropic';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { auditStore, AuditEntry } from './auditStore';
import { evaluateRules } from './rules';
import { pickDefaultRecipient } from './policy';
import { CustomPolicy } from './customPolicies';

// Cache agents per organization (keyed by config)
const agentCache = new Map<string, any>();
const mcpClientCache = new Map<string, MCPClientCredentials>();

export interface AgentConfig {
  locusClientId?: string;
  locusClientSecret?: string;
  locusMcpUrl?: string;
  whitelistedContact?: string;
  perTxnMax?: number;
  dailyMax?: number;
  customPolicies?: CustomPolicy[];
}

function getConfigKey(config?: AgentConfig): string {
  if (!config || !config.locusClientId) {
    return 'default';
  }
  // Create a unique key based on credentials
  return `${config.locusClientId}:${config.locusMcpUrl || 'default'}`;
}

async function getAgent(config?: AgentConfig) {
  const configKey = getConfigKey(config);
  
  // Return cached agent if available (for default config only, organization-specific ones are created fresh)
  if (configKey === 'default' && agentCache.has(configKey)) {
    return agentCache.get(configKey);
  }
  
  // For organization-specific configs, check cache but will create new if needed
  if (configKey !== 'default' && agentCache.has(configKey)) {
    return agentCache.get(configKey);
  }

  // Use config if provided, otherwise fall back to environment variables
  const locusUrl = config?.locusMcpUrl || process.env.LOCUS_MCP_URL || 'https://mcp.paywithlocus.com/mcp';
  const locusClientId = config?.locusClientId || process.env.LOCUS_CLIENT_ID;
  const locusClientSecret = config?.locusClientSecret || process.env.LOCUS_CLIENT_SECRET;

  // If no credentials provided, create agent without tools
  if (!locusClientId || !locusClientSecret) {
    console.warn('No Locus credentials provided - agent will work without payment tools');
    const modelName = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
    const llm = new ChatAnthropic({ model: modelName });
    const agentWithoutTools = createReactAgent({ llm, tools: [] } as any);
    // Cache agent without tools
    agentCache.set(configKey, agentWithoutTools);
    return agentWithoutTools;
  }

  // Create new MCP client with provided credentials
  const client = new MCPClientCredentials({
    mcpServers: {
      locus: {
        url: locusUrl,
        auth: {
          clientId: locusClientId,
          clientSecret: locusClientSecret,
        },
      },
    },
  });

  // Store client for manual payout fallback
  mcpClientCache.set(configKey, client);

  // 2. Connect and load tools
  await client.initializeConnections();
  const rawTools = await client.getTools();

  // 3. Use with LangChain
  const modelName = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
  const llm = new ChatAnthropic({ model: modelName });
  
  // Filter tools to remove those with invalid schemas that cause typeName errors
  const validTools: any[] = [];
  
  for (const tool of rawTools) {
    if (!tool || typeof tool !== 'object' || !tool.name) {
      continue;
    }
    
    // Check if tool has a schema that might cause issues
    let isValid = true;
    if (tool.schema && typeof tool.schema === 'object') {
      const schema = tool.schema;
      // If it's a Zod schema with _def, ensure typeName exists
      if ('_def' in schema) {
        if (!schema._def) {
          console.warn(`Skipping tool ${tool.name} - schema._def is undefined`);
          isValid = false;
        } else if (!schema._def.typeName) {
          console.warn(`Skipping tool ${tool.name} - schema._def.typeName is missing`);
          isValid = false;
        } else if (typeof schema._def.typeName !== 'string') {
          console.warn(`Skipping tool ${tool.name} - schema._def.typeName is not a string`);
          isValid = false;
        }
      }
    }
    
    if (isValid) {
      // Test if the tool can be safely bound to the LLM
      try {
        llm.bindTools([tool] as any);
        validTools.push(tool);
      } catch (bindError: any) {
        console.warn(`Skipping tool ${tool.name} - failed to bind: ${bindError.message}`);
      }
    }
  }

  console.log(`Using ${validTools.length} of ${rawTools.length} tools`);

  // Get policy rules for the prompt
  const whitelistedContact = process.env.WHITELISTED_CONTACT!;
  const perTxnMax = parseFloat(process.env.PER_TXN_MAX || '0.50');
  const dailyMax = parseFloat(process.env.DAILY_MAX || '3.0');
  const today = new Date().toISOString().split('T')[0];
  const todayTotal = auditStore.getDailyTotal(today);

  // Create agent following the exact pattern from the example
  // Wrap in try-catch to handle schema errors gracefully
  let createdAgent: any;
  try {
    // If we have valid tools, use them; otherwise create agent without tools
    if (validTools.length > 0) {
      createdAgent = createReactAgent({ llm, tools: validTools } as any);
      console.log('Agent created successfully with tools');
    } else {
      console.warn('No valid tools available, creating agent without tools');
      createdAgent = createReactAgent({ 
        llm, 
        tools: [] 
      } as any);
    }
  } catch (error: any) {
    // If we get a typeName error, try creating agent without tools
    if (error.message?.includes('typeName') || 
        error.message?.includes('Cannot read properties') ||
        error.message?.includes('undefined')) {
      console.error('Error creating agent with tools:', error.message);
      console.log('Attempting to create agent without tools...');
      
      try {
        // Try creating agent without tools as fallback
        createdAgent = createReactAgent({ 
          llm, 
          tools: [] 
        } as any);
        
        console.warn('Agent created without MCP tools - will need manual payment processing');
      } catch (fallbackError: any) {
        console.error('Failed to create agent even without tools:', fallbackError.message);
        throw new Error(`Failed to create agent: ${fallbackError.message}`);
      }
    } else {
      throw error;
    }
  }

  // Cache agent for reuse (both default and org-specific)
  agentCache.set(configKey, createdAgent);

  return createdAgent;
}

export interface AgentResponse {
  status: 'approved' | 'rejected';
  amount: number;
  purpose: string;
  recipient?: string;
  reason?: string;
  txId?: string;
  error?: string;
  // Extended fields for MVP explainability
  decision?: 'approve' | 'deny' | 'review';
  confidence?: number;
  explanations?: Array<{
    id: string;
    label?: string;
    reason: string;
    weight?: number;
  }>;
  traceId?: string;
}

export async function processClaim(userInput: string, config?: AgentConfig): Promise<AgentResponse> {
  // Extract amount from input as fallback (even if agent fails)
  const amountMatch = userInput.match(/\$?([\d.]+)/);
  const extractedAmount = amountMatch ? parseFloat(amountMatch[1]) : 0;

  try {
    let agentInstance;
    
    // Try to get agent, but if model fails during invocation, we'll handle it
    try {
      agentInstance = await getAgent(config);
    } catch (error: any) {
      // Return with extracted amount instead of 0
      return {
        status: 'rejected',
        amount: extractedAmount,
        purpose: userInput,
        reason: `Failed to initialize agent: ${error.message}. Please check tool configurations.`,
        error: error.message,
      };
    }
    
    // Build prompt with policy rules - use config if provided, otherwise env vars
    const whitelistedContact = config?.whitelistedContact || process.env.WHITELISTED_CONTACT || '';
    const perTxnMax = config?.perTxnMax || parseFloat(process.env.PER_TXN_MAX || '0.50');
    const dailyMax = config?.dailyMax || parseFloat(process.env.DAILY_MAX || '3.0');
    const today = new Date().toISOString().split('T')[0];
    const todayTotal = auditStore.getDailyTotal(today);

    // Build custom policies section for prompt
    let customPoliciesSection = '';
    if (config?.customPolicies && config.customPolicies.length > 0) {
      const customPoliciesList = config.customPolicies.map((p, idx) => {
        const config = p.rule_config as any;
        let ruleText = '';
        
        switch (p.rule_type) {
          case 'amount_limit':
            if (config.maxAmount) ruleText += `Maximum amount: $${config.maxAmount.toFixed(2)}. `;
            if (config.minAmount) ruleText += `Minimum amount: $${config.minAmount.toFixed(2)}. `;
            break;
          case 'purpose_restriction':
            if (config.allowedKeywords?.length) ruleText += `Purpose must contain one of: ${config.allowedKeywords.join(', ')}. `;
            if (config.blockedKeywords?.length) ruleText += `Purpose must NOT contain: ${config.blockedKeywords.join(', ')}. `;
            break;
          case 'time_restriction':
            if (config.allowedDays?.length) ruleText += `Claims only allowed on: ${config.allowedDays.join(', ')}. `;
            if (config.allowedHours) ruleText += `Claims only allowed between ${config.allowedHours.start} and ${config.allowedHours.end}. `;
            break;
          case 'employee_restriction':
            if (config.allowedEmployeeIds?.length) ruleText += `Only specific employees allowed. `;
            if (config.blockedEmployeeIds?.length) ruleText += `Specific employees blocked. `;
            break;
          case 'category_restriction':
            if (config.allowedCategories?.length) ruleText += `Only categories allowed: ${config.allowedCategories.join(', ')}. `;
            if (config.blockedCategories?.length) ruleText += `Categories blocked: ${config.blockedCategories.join(', ')}. `;
            break;
          case 'custom_condition':
            ruleText += `Custom condition: ${config.condition || ''}. `;
            break;
        }
        
        return `${idx + 5}. ${p.name}${p.description ? ` (${p.description})` : ''}: ${ruleText}`;
      }).join('\n');
      
      customPoliciesSection = `\n\nCUSTOM POLICIES (STRICTLY ENFORCE):
${customPoliciesList}

These custom policies are in addition to the standard policies above. ALL policies must pass for approval.`;
    }

    const prompt = `You are AutoPay Agent, an AI assistant that processes expense claims and makes payments using Locus MCP tools.

POLICY RULES (STRICTLY ENFORCE):
1. DEFAULT RECIPIENT: If no recipient is mentioned in the claim, automatically use the whitelisted contact: ${whitelistedContact}
2. RECIPIENT CHECK: Only pay to whitelisted contact ${whitelistedContact}. If a different recipient is mentioned, reject. If no recipient is mentioned, use ${whitelistedContact} (PASSES check).
3. Maximum per transaction: $${perTxnMax.toFixed(2)}
4. Maximum daily total: $${dailyMax.toFixed(2)} (Current today: $${todayTotal.toFixed(2)}, Remaining: $${(dailyMax - todayTotal).toFixed(2)})${customPoliciesSection}

WORKFLOW:
1. Parse the expense claim to extract amount and purpose
2. RECIPIENT: If recipient is mentioned, check if it matches ${whitelistedContact}. If not mentioned, DEFAULT to ${whitelistedContact} (this is OK).
3. Check if amount is within per-transaction limit (max $${perTxnMax.toFixed(2)})
4. Check if adding this amount would exceed daily limit (current today: $${todayTotal.toFixed(2)}, remaining: $${(dailyMax - todayTotal).toFixed(2)})
5. If ALL rules pass, use the payout/payment tool to send USDC to ${whitelistedContact}
6. Only reject if: amount exceeds limits, OR a different recipient (not ${whitelistedContact}) is explicitly mentioned

IMPORTANT: Missing recipient is NOT a reason for rejection - always default to ${whitelistedContact}.

Process this expense claim: "${userInput}"

Always provide a structured response with status (approved/rejected), amount, purpose, and reason or transaction ID.`;

    let result;
    try {
      result = await agentInstance.invoke({
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (error: any) {
      // If model not found error, provide helpful error message
      if (error.message?.includes('404') || error.message?.includes('not_found') || error.message?.includes('model')) {
        console.error('Model not found error:', error.message);
        const errorJson = error.message.includes('{') ? JSON.parse(error.message.split('{')[1].split('}')[0] + '}') : null;
        const suggestedModel = errorJson?.error?.message?.includes('claude-3-5') 
          ? 'claude-3-sonnet-20240229' 
          : 'claude-3-sonnet-20240229';
        
        return {
          status: 'rejected',
          amount: 0,
          purpose: userInput,
          reason: `Model not found: The Anthropic model "${process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229'}" is not available. Try setting ANTHROPIC_MODEL to a valid model like "${suggestedModel}", "claude-3-opus-20240229", or "claude-3-haiku-20240307"`,
          error: error.message,
        };
      }
      throw error;
    }

    // Extract the final message from the agent
    // Handle different response formats from LangGraph
    const messages = result.messages || (Array.isArray(result) ? result : [result]);
    
    // Log all messages for debugging
    console.log('=== Agent Response Messages ===');
    console.log(`Total messages: ${messages.length}`);
    messages.forEach((msg: any, idx: number) => {
      console.log(`Message ${idx}:`, {
        type: typeof msg === 'string' ? 'string' : msg?.constructor?.name || typeof msg,
        hasToolCalls: !!(msg as any)?.tool_calls,
        toolCallsCount: (msg as any)?.tool_calls?.length || 0,
        contentPreview: typeof msg === 'string' 
          ? msg.substring(0, 100) 
          : (msg?.content || msg?.text || '')?.substring(0, 100),
      });
    });
    console.log('=== End Agent Response ===');
    
    const lastMessage = messages[messages.length - 1];
    const responseText = typeof lastMessage === 'string' 
      ? lastMessage 
      : (lastMessage?.content || lastMessage?.text || JSON.stringify(result));

    // Try to parse structured response from agent
    let parsed: AgentResponse;
    try {
      // Look for JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: try to extract info from text
        const amountMatch = responseText.match(/\$?([\d.]+)/);
        parsed = {
          status: responseText.toLowerCase().includes('approved') || responseText.toLowerCase().includes('success') ? 'approved' : 'rejected',
          amount: amountMatch ? parseFloat(amountMatch[1]) : 0,
          purpose: userInput,
          reason: responseText,
        };
      }
    } catch {
      // If parsing fails, try to infer from response
      const amountMatch = responseText.match(/\$?([\d.]+)/);
      parsed = {
        status: responseText.toLowerCase().includes('approved') || responseText.toLowerCase().includes('success') ? 'approved' : 'rejected',
        amount: amountMatch ? parseFloat(amountMatch[1]) : 0,
        purpose: userInput,
        reason: responseText,
      };
    }

    // Check if agent actually called a payout tool
    let toolWasCalled = false;
    let toolCallResult: any = null;
    let realTxIdFromTool: string | undefined = undefined;
    
    // Search through all messages for tool calls
    for (const msg of messages) {
      if (msg && typeof msg === 'object') {
        // Check for tool_calls in the message
        const toolCalls = (msg as any)?.tool_calls || [];
        
        for (const toolCall of toolCalls) {
          console.log('Found tool call:', {
            name: toolCall?.name,
            args: toolCall?.args,
            result: toolCall?.result,
            hasResult: !!toolCall?.result,
          });
          
          if (toolCall?.name && (
            toolCall.name.includes('payout') || 
            toolCall.name.includes('send') ||
            toolCall.name.includes('payment')
          )) {
            toolWasCalled = true;
            toolCallResult = toolCall.result || toolCall;
            
            // Only extract transaction ID from ACTUAL tool results, not text descriptions
            if (toolCall.result && toolCall.result !== 'pending' && toolCall.result !== 'success') {
              if (typeof toolCall.result === 'object' && !Array.isArray(toolCall.result)) {
                // Real tool result object
                realTxIdFromTool = toolCall.result.transactionId || 
                                  toolCall.result.id || 
                                  toolCall.result.txId ||
                                  toolCall.result.transaction_id ||
                                  toolCall.result.transactionId;
                if (realTxIdFromTool) {
                  parsed.txId = realTxIdFromTool;
                  console.log('Real transaction ID from tool:', realTxIdFromTool);
                }
              } else if (typeof toolCall.result === 'string') {
                // Only trust JSON results, not arbitrary text
                try {
                  const resultObj = JSON.parse(toolCall.result);
                  if (resultObj.transactionId || resultObj.id || resultObj.txId) {
                    realTxIdFromTool = resultObj.transactionId || resultObj.id || resultObj.txId;
                    parsed.txId = realTxIdFromTool;
                    console.log('Real transaction ID from JSON:', realTxIdFromTool);
                  }
                } catch (e) {
                  // Not JSON - don't trust string results that aren't JSON
                  console.log('Tool result is not JSON, ignoring as potential fake ID');
                }
              }
            }
          }
        }
        
        // Also check for tool message responses (AIMessage with tool calls)
        if ((msg as any)?.tool_calls && (msg as any).tool_calls.length > 0) {
          // Check if there are tool message responses
          const toolMessages = messages.filter((m: any) => 
            m.tool_call_id || m.role === 'tool'
          );
          for (const toolMsg of toolMessages) {
            if (toolMsg.content && typeof toolMsg.content === 'object') {
              const txId = toolMsg.content.transactionId || toolMsg.content.id || toolMsg.content.txId;
              if (txId) {
                realTxIdFromTool = txId;
                parsed.txId = txId;
                console.log('Real transaction ID from tool message:', txId);
              }
            }
          }
        }
      }
    }
    
    console.log('Tool execution summary:', {
      toolWasCalled,
      hasRealTxId: !!realTxIdFromTool,
      realTxId: realTxIdFromTool,
    });
    
    // Clear any fake transaction IDs extracted from text (only trust real tool results)
    if (!realTxIdFromTool && parsed.txId) {
      // If we have a txId but it didn't come from a real tool execution, it's probably fake
      console.warn(`Transaction ID "${parsed.txId}" found in text but no real tool was executed. Clearing fake ID.`);
      parsed.txId = undefined;
    }
    
    // Ensure amount/purpose are set BEFORE any manual payout attempts
    if (!parsed.amount || isNaN(Number(parsed.amount))) {
      const fallbackMatchEarly = userInput.match(/\$?([\d.]+)/);
      parsed.amount = fallbackMatchEarly ? parseFloat(fallbackMatchEarly[1]) : 0;
    }
    if (!parsed.purpose) {
      parsed.purpose = userInput;
    }

    // If approved, ALWAYS try to execute payment (even if agent said it did)
    // Only skip if we have a REAL transaction ID from tool execution
    // Determine final recipient early for payout attempts
    const recipientFinal = parsed.recipient || pickDefaultRecipient() || whitelistedContact;
    if (parsed.status === 'approved' && !realTxIdFromTool) {
      console.log('Agent approved but did not execute payment. Manually calling MCP payout...');
      
      try {
        // Get the MCP client for this config
        const configKey = config ? getConfigKey(config) : 'default';
        const mcpClient = mcpClientCache.get(configKey);
        
        // Use the MCP client directly to call the payout tool
        if (mcpClient) {
          let toolResult: any = null;
          
          // Get all available tools
          const tools = await mcpClient.getTools();
          console.log('Available tools:', tools.map((t: any) => t.name));
          
          // Determine recipient type from selected recipient
          const wc = recipientFinal || '';
          const isEmail = /@/.test(wc);
          const isAddress = /^0x[a-fA-F0-9]{40}$/.test(wc);
          const recipientType = isEmail ? 'email' : (isAddress ? 'address' : 'contact');

          // Prefer the tool that matches the recipient type
          const payoutToolNames = (
            recipientType === 'address' ? ['send_to_address', 'send_to_contact', 'send_to_email'] :
            recipientType === 'email' ? ['send_to_email', 'send_to_contact', 'send_to_address'] :
            ['send_to_contact', 'send_to_address', 'send_to_email']
          );
          let selectedTool: any = null;
          
          for (const toolName of payoutToolNames) {
            const tool = tools.find((t: any) => t.name === toolName);
            if (tool) {
              selectedTool = tool;
              console.log(`Selected payout tool: ${toolName}`);
              break;
            }
          }
          
          if (!selectedTool) {
            throw new Error(`No payout tool found. Available tools: ${tools.map((t: any) => t.name).join(', ')}`);
          }
          
          // Inspect the tool schema to get exact parameter names
          const schema = selectedTool.schema || {};
          const schemaAny = schema as any;
          
          // Extract parameter names from schema - try multiple ways
          let paramNames: string[] = [];
          let requiredParams: string[] = [];
          let paramTypes: Record<string, string> = {};
          
          // Method 1: Zod schema (_def.shape)
          if (schemaAny._def?.shape) {
            paramNames = Object.keys(schemaAny._def.shape);
            // Check for required fields
            if (schemaAny._def.shape) {
              paramNames.forEach(param => {
                const paramDef = schemaAny._def.shape[param];
                if (paramDef?._def) {
                  paramTypes[param] = paramDef._def.typeName || 'unknown';
                }
              });
            }
          }
          // Method 2: JSON Schema (properties)
          else if (schemaAny.properties) {
            paramNames = Object.keys(schemaAny.properties);
            requiredParams = schemaAny.required || [];
            paramNames.forEach(param => {
              paramTypes[param] = schemaAny.properties[param]?.type || 'unknown';
            });
          }
          // Method 3: Try to extract from any nested structure
          else {
            // Deep inspection - look for any object with keys
            const schemaStr = JSON.stringify(schema);
            console.log('Schema string:', schemaStr);
            
            // Try to find property-like patterns
            const propMatches = schemaStr.match(/"([a-zA-Z_][a-zA-Z0-9_]*)":/g);
            if (propMatches) {
              paramNames = propMatches.map(m => m.replace(/"/g, '').replace(':', '')).filter((v, i, a) => a.indexOf(v) === i);
            }
          }
          
          console.log(`Tool "${selectedTool.name}" schema analysis:`);
          console.log(`  - Parameter names:`, paramNames);
          console.log(`  - Required params:`, requiredParams);
          console.log(`  - Param types:`, paramTypes);
          console.log(`  - Full schema:`, JSON.stringify(schema, null, 2));
          
          // Build parameters based on actual schema requirements
          // Try multiple parameter combinations until one works
          const tryParameterCombinations = async () => {
            const attempts: Array<{ params: any; description: string }> = [];
            
            // Build base parameter combinations based on tool name
            const toolNameLower = selectedTool.name.toLowerCase();
            const chain = process.env.LOCUS_CHAIN || 'base';
            const network = process.env.LOCUS_NETWORK || 'mainnet';
            const amountNumber = Number.isFinite(parsed.amount) ? parsed.amount : parseFloat(String(parsed.amount)) || 0;
            const amountString = amountNumber.toFixed(2);
            const usdcMinor = Math.round(amountNumber * 1e6);
            
            if (toolNameLower.includes('send_to_contact')) {
              attempts.push(
                { params: { contact: wc, amount: amountNumber }, description: 'contact + amount (number)' },
                { params: { contact: wc, amount: amountString }, description: 'contact + amount (string)' },
                { params: { contact: wc, amount: amountNumber, currency: 'USDC' }, description: 'contact + amount + currency' },
                { params: { contact: wc, usdc_amount: usdcMinor }, description: 'contact + usdc_amount (minor units)' },
                { params: { contact: wc, value: amountNumber, currency: 'USDC' }, description: 'contact + value + currency' },
                { params: { contact: wc, amount: amountNumber, token: 'USDC' }, description: 'contact + amount + token' },
                { params: { contact: wc, amount: amountNumber, currency: 'USDC', chain, network }, description: 'contact + amount + currency + chain/network' }
              );
            } else if (toolNameLower.includes('send_to_address')) {
              attempts.push(
                { params: { address: wc, amount: amountNumber }, description: 'address + amount (number)' },
                { params: { address: wc, amount: amountString }, description: 'address + amount (string)' },
                { params: { address: wc, amount: amountNumber, currency: 'USDC' }, description: 'address + amount + currency' },
                { params: { address: wc, usdc_amount: usdcMinor }, description: 'address + usdc_amount (minor units)' },
                { params: { address: wc, value: amountNumber, currency: 'USDC' }, description: 'address + value + currency' },
                { params: { address: wc, amount: amountNumber, token: 'USDC' }, description: 'address + amount + token' },
                { params: { address: wc, amount: amountNumber, currency: 'USDC', chain, network }, description: 'address + amount + currency + chain/network' }
              );
            } else if (toolNameLower.includes('send_to_email')) {
              attempts.push(
                { params: { email: wc, amount: amountNumber }, description: 'email + amount (number)' },
                { params: { email: wc, amount: amountString }, description: 'email + amount (string)' },
                { params: { email: wc, amount: amountNumber, currency: 'USDC' }, description: 'email + amount + currency' },
                { params: { email: wc, usdc_amount: usdcMinor }, description: 'email + usdc_amount (minor units)' }
              );
            }
            
            // Also add attempts based on discovered paramNames from schema
            if (paramNames.length > 0) {
              const recipientFields = ['contact', 'address', 'email', 'recipient', 'to'];
              const amountFields = ['amount', 'value', 'usdc_amount'];
              
              const recipientField = recipientFields.find(f => paramNames.some(p => p.toLowerCase() === f));
              const amountField = amountFields.find(f => paramNames.some(p => p.toLowerCase() === f));
              
              if (recipientField && amountField) {
                // Try exact schema match first (highest priority)
                attempts.unshift({
                  params: { [recipientField]: wc, [amountField]: parsed.amount },
                  description: `exact schema: ${recipientField} + ${amountField}`
                });
                
                // Try with currency if it's in the schema
                if (paramNames.some(p => p.toLowerCase() === 'currency')) {
                  attempts.unshift({
                    params: { [recipientField]: wc, [amountField]: amountNumber, currency: 'USDC' },
                    description: `exact schema with currency`
                  });
                }
                
                // Try with token if it's in the schema
                if (paramNames.some(p => p.toLowerCase() === 'token')) {
                  attempts.unshift({
                    params: { [recipientField]: wc, [amountField]: amountNumber, token: 'USDC' },
                    description: `exact schema with token`
                  });
                }
                
                // Try all fields from schema (respect required vs optional)
                const allParams: any = {};
                if (recipientField) allParams[recipientField] = wc;
                if (amountField) allParams[amountField] = amountNumber;
                
                // Add optional fields that exist in schema
                paramNames.forEach(p => {
                  if (p.toLowerCase() === 'currency' && !allParams.currency) {
                    allParams.currency = 'USDC';
                  }
                  if (p.toLowerCase() === 'token' && !allParams.token) {
                    allParams.token = 'USDC';
                  }
                  if (p.toLowerCase() === 'memo' || p.toLowerCase() === 'note' || p.toLowerCase() === 'purpose' || p.toLowerCase() === 'description') {
                    allParams[p] = parsed.purpose || 'Expense reimbursement';
                  }
                  if (p.toLowerCase() === 'chain' && !allParams.chain) {
                    allParams.chain = chain;
                  }
                  if (p.toLowerCase() === 'network' && !allParams.network) {
                    allParams.network = network;
                  }
                });
                
                if (Object.keys(allParams).length > 2) {
                  attempts.unshift({
                    params: allParams,
                    description: `all schema params: ${Object.keys(allParams).join(', ')}`
                  });
                }
              }
            }
            
            // If no paramNames found, try very basic combinations
            if (paramNames.length === 0) {
              console.warn('No parameters extracted from schema, trying basic combinations');
              const toolNameLower = selectedTool.name.toLowerCase();
              if (toolNameLower.includes('contact')) {
                attempts.push({ params: { contact: wc, amount: parsed.amount }, description: 'basic: contact + amount' });
              } else if (toolNameLower.includes('address')) {
                attempts.push({ params: { address: wc, amount: parsed.amount }, description: 'basic: address + amount' });
              } else if (toolNameLower.includes('email')) {
                attempts.push({ params: { email: wc, amount: parsed.amount }, description: 'basic: email + amount' });
              }
            }
            
            // Try each combination
            let lastError: any = null;
            let lastErrorDetails: any = null;
            
            console.log(`Trying ${attempts.length} parameter combinations...`);
            
            for (let i = 0; i < attempts.length; i++) {
              const attempt = attempts[i];
              try {
                console.log(`[${i + 1}/${attempts.length}] Trying: ${attempt.description}`);
                console.log(`  Params:`, JSON.stringify(attempt.params, null, 2));
                
                // Try via callTool first (most direct method)
                if (typeof (mcpClient as any).callTool === 'function') {
                  try {
                    const result = await (mcpClient as any).callTool('locus', selectedTool.name, attempt.params);
                    console.log(`✓✓✓ SUCCESS with ${attempt.description} via callTool`);
                    console.log(`  Result:`, JSON.stringify(result, null, 2));
                    return result;
                  } catch (callError: any) {
                    lastError = callError;
                    lastErrorDetails = {
                      method: 'callTool',
                      params: attempt.params,
                      error: callError.message || callError.toString(),
                      stack: callError.stack,
                      response: callError.response || callError.body
                    };
                    console.log(`  ✗ callTool failed: ${callError.message || callError.toString()}`);
                    
                    // Try invoke as fallback
                    if (typeof selectedTool.invoke === 'function') {
                      try {
                        console.log(`  → Trying invoke() as fallback...`);
                        const result = await selectedTool.invoke(attempt.params);
                        console.log(`✓✓✓ SUCCESS with ${attempt.description} via invoke`);
                        console.log(`  Result:`, JSON.stringify(result, null, 2));
                        return result;
                      } catch (invokeError: any) {
                        lastError = invokeError;
                        lastErrorDetails = {
                          method: 'invoke',
                          params: attempt.params,
                          error: invokeError.message || invokeError.toString(),
                          stack: invokeError.stack
                        };
                        console.log(`  ✗ invoke also failed: ${invokeError.message || invokeError.toString()}`);
                        continue;
                      }
                    }
                    continue;
                  }
                } 
                // If no callTool, try invoke directly
                else if (typeof selectedTool.invoke === 'function') {
                  try {
                    const result = await selectedTool.invoke(attempt.params);
                    console.log(`✓✓✓ SUCCESS with ${attempt.description} via invoke`);
                    console.log(`  Result:`, JSON.stringify(result, null, 2));
                    return result;
                  } catch (invokeError: any) {
                    lastError = invokeError;
                    lastErrorDetails = {
                      method: 'invoke',
                      params: attempt.params,
                      error: invokeError.message || invokeError.toString(),
                      stack: invokeError.stack
                    };
                    console.log(`  ✗ invoke failed: ${invokeError.message || invokeError.toString()}`);
                    continue;
                  }
                } else {
                  throw new Error('No callable method available (callTool or invoke)');
                }
              } catch (error: any) {
                lastError = error;
                lastErrorDetails = {
                  method: 'unknown',
                  params: attempt.params,
                  error: error.message || error.toString(),
                  stack: error.stack
                };
                console.log(`  ✗ Exception: ${error.message || error.toString()}`);
                continue;
              }
            }
            
            // All attempts failed - provide detailed error
            console.error('All parameter combinations failed. Details:', JSON.stringify(lastErrorDetails, null, 2));
            const errorMsg = `All ${attempts.length} parameter combinations failed. `;
            const detailedMsg = lastErrorDetails ? 
              `Last attempt: ${lastErrorDetails.method} with params ${JSON.stringify(lastErrorDetails.params)}. Error: ${lastErrorDetails.error}` :
              `Last error: ${lastError?.message || 'Unknown'}`;
            
            throw new Error(errorMsg + detailedMsg);
          };
          
          toolResult = await tryParameterCombinations();
          console.log('Tool execution successful. Result:', toolResult);
          
          // Extract transaction ID from result
          const resultObj = typeof toolResult === 'string' 
            ? (() => {
                try {
                  return JSON.parse(toolResult);
                } catch {
                  return { raw: toolResult };
                }
              })()
            : toolResult;
          
          parsed.txId = resultObj?.transactionId || 
                       resultObj?.id || 
                       resultObj?.txId ||
                       resultObj?.transaction_id ||
                       resultObj?.tx_id ||
                       resultObj?.raw;
          
          if (parsed.txId && parsed.txId !== 'pending' && !parsed.txId.toString().includes('Agent')) {
            parsed.reason = (parsed.reason || '') + ` Payment executed via MCP. Transaction ID: ${parsed.txId}`;
            parsed.status = 'approved';
            console.log('MCP payout executed successfully:', parsed.txId);
          } else {
            console.warn('Tool executed but no valid transaction ID found in result:', toolResult);
            parsed.reason = (parsed.reason || '') + ` Payment executed via MCP (transaction ID pending verification)`;
          }
        } else {
          throw new Error('MCP client not initialized');
        }
      } catch (payoutError: any) {
        parsed.status = 'rejected';
        parsed.reason = (parsed.reason || '') + ` Failed to execute payment: ${payoutError.message || payoutError.error || 'Unknown error'}`;
        parsed.error = payoutError.message || payoutError.error;
        console.error('Error executing MCP payout:', payoutError);
      }
    }
    
    // DON'T extract transaction IDs from text - they're unreliable
    // Only use transaction IDs from actual tool execution results
    
    // Ensure we have required fields
    if (!parsed.amount) {
      const fallbackMatch = userInput.match(/\$?([\d.]+)/);
      parsed.amount = fallbackMatch ? parseFloat(fallbackMatch[1]) : 0;
    }
    if (!parsed.purpose) {
      parsed.purpose = userInput;
    }

    // Compute decision, confidence, explanations, and traceId based on deterministic rules
    try {
      const recipientFinal = parsed.recipient || pickDefaultRecipient() || process.env.WHITELISTED_CONTACT!;
      const evaln = await evaluateRules(Number(parsed.amount) || 0, recipientFinal);
      const total = evaln.results.length || 1;
      const passed = evaln.results.filter((r: any) => r.passed).length;
      const confidence = Math.max(0, Math.min(1, passed / total));
      parsed.decision = evaln.approved ? 'approve' : 'deny';
      parsed.confidence = confidence;
      parsed.explanations = evaln.results.map((r: any) => ({
        id: r.id,
        label: r.label,
        reason: r.reason || (r.passed ? 'Rule passed' : 'Rule failed'),
        weight: typeof r.weight === 'number' ? r.weight : undefined,
      }));
      parsed.recipient = recipientFinal;
      // Append deterministic reason if none present
      if (!parsed.reason && evaln.reason) {
        parsed.reason = evaln.reason;
      }
      // Generate a simple trace id
      const rand = Math.random().toString(36).slice(2, 10);
      parsed.traceId = `tr_${Date.now().toString(36)}_${rand}`;
    } catch (e) {
      // Non-fatal: continue without extended fields
    }

    // Log to audit store
    const auditEntry: AuditEntry = {
      timestamp: new Date().toISOString(),
      status: parsed.status,
      amount: parsed.amount,
      purpose: parsed.purpose,
      recipient: parsed.recipient || process.env.WHITELISTED_CONTACT!,
      reason: parsed.reason,
      txId: parsed.txId,
      error: parsed.error,
    };
    auditStore.addEntry(auditEntry);

    return parsed;
  } catch (error: any) {
    console.error('Agent error:', error);
    return {
      status: 'rejected',
      amount: 0,
      purpose: userInput,
      reason: `Agent error: ${error.message}`,
      error: error.message,
    };
  }
}

