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
} as const

export type ProviderId = keyof typeof PROVIDERS
