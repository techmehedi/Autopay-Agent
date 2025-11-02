import { parseClaim } from '@/lib/parseClaim';

// Mock OpenAI SDK
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

describe('Claim Parsing', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    jest.clearAllMocks();
  });

  it('should extract amount from text with dollar sign', async () => {
    const OpenAI = require('openai');
    const mockOpenAI = new OpenAI();
    
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: '{"amount": 0.35, "purpose": "coffee"}',
          },
        },
      ],
    });

    const result = await parseClaim('Reimburse $0.35 for coffee');
    expect(result.amount).toBe(0.35);
    expect(result.purpose).toContain('coffee');
  });

  it('should extract amount from text without dollar sign', async () => {
    const OpenAI = require('openai');
    const mockOpenAI = new OpenAI();
    
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: '{"amount": 0.25, "purpose": "snack"}',
          },
        },
      ],
    });

    const result = await parseClaim('Reimburse 0.25 for snack');
    expect(result.amount).toBe(0.25);
  });

  it('should fallback to regex extraction on API error', async () => {
    const OpenAI = require('openai');
    const mockOpenAI = new OpenAI();
    
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

    const result = await parseClaim('Reimburse $0.35 for coffee');
    expect(result.amount).toBe(0.35);
    expect(result.purpose).toBe('Reimburse $0.35 for coffee');
  });

  it('should handle JSON wrapped in markdown code blocks', async () => {
    const OpenAI = require('openai');
    const mockOpenAI = new OpenAI();
    
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: '```json\n{"amount": 0.35, "purpose": "coffee"}\n```',
          },
        },
      ],
    });

    const result = await parseClaim('Reimburse $0.35 for coffee');
    expect(result.amount).toBe(0.35);
  });

  it('should extract recipient if mentioned', async () => {
    const OpenAI = require('openai');
    const mockOpenAI = new OpenAI();
    
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: '{"amount": 0.35, "purpose": "coffee", "recipient": "0x123"}',
          },
        },
      ],
    });

    const result = await parseClaim('Reimburse $0.35 for coffee to 0x123');
    expect(result.recipient).toBe('0x123');
  });
});

