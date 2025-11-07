# Testing Guide for AutoPay Agent

This document explains how to run tests for the AutoPay Agent project.

## Setup

Install test dependencies:

```bash
npm install
```

## Running Tests

### Run all tests:
```bash
npm test
```

### Run tests in watch mode (useful during development):
```bash
npm run test:watch
```

### Run tests with coverage report:
```bash
npm run test:coverage
```

## Test Structure

Tests are organized in the `__tests__` directory:

```
__tests__/
├── api/
│   ├── claim.test.ts        # API endpoint for claim processing
│   └── audit.test.ts        # API endpoint for audit log
├── lib/
│   ├── agent.test.ts        # LangChain agent logic
│   ├── auditStore.test.ts   # Audit log storage
│   ├── mcpClient.test.ts    # MCP client integration
│   ├── parseClaim.test.ts   # Claim parsing logic
│   └── rules.test.ts        # Policy rule enforcement
└── integration/
    └── end-to-end.test.ts   # Full workflow tests
```

## Test Coverage

Tests cover:

1. **Policy Rules** (`rules.test.ts`):
   - Recipient validation (whitelist)
   - Per-transaction limits
   - Daily spending limits
   - Combined rule checks

2. **Audit Store** (`auditStore.test.ts`):
   - Adding entries
   - Retrieving all entries
   - Calculating daily totals
   - File I/O handling

3. **Claim Parsing** (`parseClaim.test.ts`):
   - Amount extraction
   - Purpose extraction
   - Recipient extraction
   - Error handling

4. **MCP Client** (`mcpClient.test.ts`):
   - Client initialization
   - Payout execution
   - Transaction ID extraction
   - Error handling

5. **API Endpoints** (`claim.test.ts`, `audit.test.ts`):
   - Request validation
   - Response formatting
   - Error handling
   - Status codes

6. **Integration** (`end-to-end.test.ts`):
   - Full claim processing flow
   - Approval/rejection scenarios
   - Payment execution

## Mocking

Tests use Jest mocks for external dependencies:

- **MCP Client**: Mocked to avoid actual API calls
- **Anthropic/OpenAI**: Mocked to avoid API costs
- **File System**: Mocked for audit log tests
- **LangChain**: Mocked for agent tests

## Environment Variables

Some tests require environment variables. They are mocked in test setup, but you can override them:

- `WHITELISTED_CONTACT`: Ethereum address for whitelisted recipient
- `PER_TXN_MAX`: Maximum per-transaction amount
- `DAILY_MAX`: Maximum daily spending limit
- `ANTHROPIC_API_KEY`: Anthropic API key (mocked in tests)
- `LOCUS_CLIENT_ID`, `LOCUS_CLIENT_SECRET`: Locus MCP credentials (mocked)

## Continuous Integration

For CI/CD pipelines:

```bash
# Install and run tests
npm ci
npm test

# Check coverage threshold
npm run test:coverage
```

## Troubleshooting

### Tests fail with "Cannot find module"
- Run `npm install` to ensure all dependencies are installed
- Check that `node_modules` exists

### Tests timeout
- Some tests may require network access for mocking
- Check your firewall/network settings

### Coverage is low
- Add more test cases for uncovered code paths
- Check `jest.config.js` for coverage configuration

## Writing New Tests

When adding new functionality:

1. Create a test file in the appropriate `__tests__` directory
2. Follow existing test patterns
3. Mock external dependencies
4. Test both success and error cases
5. Ensure tests are isolated (use `beforeEach` to reset state)

Example:

```typescript
describe('New Feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should work correctly', () => {
    // Test implementation
  });
});
```

