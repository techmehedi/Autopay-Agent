# AutoPay Agent

AutoPay Agent is a minimal, production-friendly AI agent that processes expense claims and, when compliant with policy, pays them out in USDC via Locus MCP (Machine Control Protocol).

The system parses free-form text like "reimburse $0.35 for coffee", applies strict policy rules (whitelist, per-tx limit, daily limit), executes a real MCP payout, and writes a detailed audit trail.

## How it works

- **UI (Next.js App Router)**: A simple form in `app/page.tsx` sends claims to an API route and renders results plus the audit log.
- **API**: `pages/api/claim.ts` receives the claim, invokes the agent, and normalizes response types for the UI.
- **Agent (LangChain + Claude)**: `lib/agent.ts` sets up an Anthropic Chat model with a ReAct agent. It embeds the policy rules in the prompt and connects to Locus MCP tools.
  - It filters and binds MCP tools safely (schema checks) to avoid Zod/typeName issues.
  - It detects whether a real tool execution happened and only trusts transaction IDs returned by tools.
  - If the agent approves but didn’t actually call a tool, a manual fallback runs that directly calls the correct Locus payout tool.
- **MCP client (Client Credentials OAuth)**: `@locus-technologies/langchain-mcp-m2m` handles secure MCP connections using Client Credentials (recommended by MCP).
- **Policy**: Enforced in-agent (whitelisted contact; per-transaction and daily totals).
- **Audit log**: `lib/auditStore.ts` stores every decision and payout attempt in `audit-log.json`.

### Policy rules (defaults)
- Whitelisted recipient only (wallet or email)
- Per-transaction max: `$0.50`
- Daily max: `$3.00`

You can override these via environment variables.

## Setup

1) Install dependencies
```bash
npm install
```

2) Create `.env.local` in the project root
```bash
LOCUS_CLIENT_ID=REPLACE_WITH_REAL
LOCUS_CLIENT_SECRET=REPLACE_WITH_REAL
LOCUS_MCP_URL=https://mcp.paywithlocus.com/mcp
ANTHROPIC_API_KEY=REPLACE_WITH_REAL

# Policy
WHITELISTED_CONTACT=0xYourWalletOrEmail
PER_TXN_MAX=0.50
DAILY_MAX=3.0

# Optional chain hints for some tools
LOCUS_CHAIN=base
LOCUS_NETWORK=mainnet
```

3) Run the app
```bash
npm run dev
# open http://localhost:3000
```

## Using the app
1. Enter a natural-language claim (e.g., "Reimburse $0.35 for coffee").
2. Submit — the agent parses, validates against policy, and if approved, pays via Locus MCP.
3. The result and every attempt is logged and visible in the audit list.

## Key files
```
app/page.tsx                # UI form + results + audit log
pages/api/claim.ts          # Claim processing API
pages/api/audit.ts          # Audit retrieval API
lib/agent.ts                # Core agent (Claude + MCP tools + manual fallback)
lib/mcpClient.ts            # MCP client (client credentials)
lib/auditStore.ts           # JSON-backed audit log
```

## Logging & troubleshooting
Run with logs saved and filter for MCP/tool lines:
```bash
npm run dev 2>&1 | tee server.log
rg -n "MCP|payout|schema|params|SUCCESS|FAILED" server.log
```

Common issues:
- Invalid Anthropic model → set `ANTHROPIC_MODEL` or rely on defaults the agent retries.
- MCP schema mismatch → the fallback now inspects tool schema and tries multiple param shapes.
- UI `.toFixed()` errors → the API and UI normalize `amount` to numbers.

## API quick reference

### POST `/api/claim`
Request
```json
{ "text": "Reimburse $0.35 for coffee" }
```
Response
```json
{
  "status": "approved" | "rejected",
  "amount": 0.35,
  "purpose": "coffee",
  "txId": "...",      
  "reason": "..."     
}
```

### GET `/api/audit`
Response
```json
[
  {
    "timestamp": "2025-11-02T14:18:04.000Z",
    "status": "approved",
    "amount": 0.35,
    "purpose": "coffee",
    "recipient": "0x...",
    "txId": "tx-..."
  }
]
```

## Security notes
- MCP uses Client Credentials OAuth (safer than API keys). Keep credentials in `.env.local`.
- The agent only pays to the configured whitelisted contact and within limits.
- The audit log captures all reasons/attempts; review it regularly.

## Tests (optional)
If you pulled test files, run:
```bash
npm test
```

---

### Credits
- Locus Technologies MCP (client-credentials MCP adapter)
- Anthropic Claude via LangChain
- Next.js (App Router)