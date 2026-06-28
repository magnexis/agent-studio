# Providers And Model Metadata

Magnexis connects to external models. It does not operate a model or inference service.

## Catalog Policy

Pinned model metadata includes a provider model ID, display name, context window, output limit when documented, source URL, lifecycle, and verification date. The current catalog was checked on `2026-06-28` against first-party provider documentation.

Gateway, local, and custom endpoints can expose models whose limits vary by account, deployment, quantization, or upstream provider. Those entries are labeled **reported by endpoint** and should be refreshed through `/models` where supported. Magnexis must not invent a context limit for them.

## Local Guardrails

Each pinned model can have local limits for:

- context tokens
- output tokens
- requests per minute
- tokens per minute

Local context and output values are clamped to documented maxima. RPM and TPM values are client-side pacing controls, not provider quota claims. Provider account and organization limits still apply and may be lower.

## Supported Presets

The shared catalog includes OpenAI, Anthropic, Google Gemini, Z.ai, Mistral, Kimi, Groq, OpenRouter, Together AI, DeepSeek, xAI, Perplexity, Cerebras, Fireworks AI, SambaNova, NVIDIA NIM, Ollama, LM Studio, and custom OpenAI-compatible endpoints.

OpenAI-compatible APIs are the primary working transport in `0.3.0`. A provider appearing in the picker does not imply every provider-native feature or payload extension is implemented. Test the connection and discovered model list before assigning it to a route.

## Updating Metadata

1. Use a first-party model or limits page.
2. Record the exact model ID and context semantics.
3. Update `contextVerifiedAt`.
4. Preserve preview/stable lifecycle labels.
5. Run compile, visual tests, and provider-picker tests.
6. Do not infer limits from model names when documentation or endpoint metadata is unavailable.
