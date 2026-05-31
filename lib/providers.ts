export const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', inputPricePer1M: 5.0, outputPricePer1M: 15.0 },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', inputPricePer1M: 0.15, outputPricePer1M: 0.6 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', inputPricePer1M: 10.0, outputPricePer1M: 30.0 },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', inputPricePer1M: 0.5, outputPricePer1M: 1.5 },
    ],
    suggestedPricePer1M: {
      'gpt-4o': 3.0,
      'gpt-4o-mini': 0.09,
      'gpt-4-turbo': 6.0,
      'gpt-3.5-turbo': 0.3,
    },
    headerKey: 'Authorization',
  },
  anthropic: {
    name: 'Anthropic',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    models: [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        inputPricePer1M: 3.0,
        outputPricePer1M: 15.0,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        inputPricePer1M: 0.8,
        outputPricePer1M: 4.0,
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        inputPricePer1M: 15.0,
        outputPricePer1M: 75.0,
      },
    ],
    suggestedPricePer1M: {
      'claude-3-5-sonnet-20241022': 1.8,
      'claude-3-5-haiku-20241022': 0.48,
      'claude-3-opus-20240229': 9.0,
    },
  },
} as const
