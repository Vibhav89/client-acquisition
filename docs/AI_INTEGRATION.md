# AI proposal integration

The application uses an optional server-side OpenAI-compatible chat-completions provider. It can connect to OpenRouter, Groq, OpenAI-compatible gateways, or another compatible endpoint.

## Environment

Set these server-side variables:

- `AI_API_KEY`: provider API key (secret; never expose it to the browser)
- `AI_MODEL`: exact model identifier enabled for that key
- `AI_BASE_URL`: optional API base URL; defaults to `https://openrouter.ai/api/v1`

AI remains disabled if either `AI_API_KEY` or `AI_MODEL` is missing. The deterministic proposal generator remains available as the baseline.

## Safety and cost controls

- Requests run server-side and require the user's authenticated session.
- Proposal generation uses the saved opportunity and the user's saved profile.
- The prompt explicitly forbids fabricated experience, credentials, metrics, and portfolio links.
- Provider calls have a 25-second timeout and a 900-token output ceiling.
- Provider error bodies are not returned to users.
- Generated proposals remain drafts; no application or message is submitted automatically.
- Add provider-side spend limits and rotate keys if exposed. Never commit secrets to Git.
