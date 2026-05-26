import { createOpenAI } from '@ai-sdk/openai';
export { generateObject } from 'ai';

// Supported provider configurations.
// Both Gemini and Anthropic expose an OpenAI-compatible REST API, so we can
// reach them through @ai-sdk/openai by pointing it at a different baseURL.
const PROVIDERS = {
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    apiKeyEnv: 'GEMINI_API_KEY',
    model: 'gemini-3.1-flash-lite',
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1/',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    model: 'claude-haiku-4-5-20251001',
  },
} as const;

type ProviderName = keyof typeof PROVIDERS;

/**
 * Returns a Vercel AI SDK LanguageModel for the provider named in LLM_PROVIDER.
 * Defaults to "gemini" when the env var is absent.
 *
 * Usage:
 *   const { object } = await generateObject({ model: getModel(), schema, prompt });
 */
export function getModel() {
  const providerName = (process.env.LLM_PROVIDER ?? 'gemini') as ProviderName;

  const config = PROVIDERS[providerName];
  if (!config) {
    throw new Error(
      `Unknown LLM_PROVIDER "${providerName}". Supported values: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }

  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    throw new Error(
      `Missing env var "${config.apiKeyEnv}" required for provider "${providerName}"`
    );
  }

  // createOpenAI returns a provider factory; calling it with the model name
  // produces a LanguageModel the Vercel AI SDK understands.
  const provider = createOpenAI({ baseURL: config.baseURL, apiKey });
  return provider(config.model);
}
