# Connecting an approved LLM

The AI Analyst works in two modes:

| Mode | When | How answers are produced |
|---|---|---|
| **Governed engine** (default) | No LLM configured, `index.html` opened directly, or the LLM errors | A deterministic intent router calls the governed tools. Works offline and gives the same answer every time |
| **Approved LLM** | `server.js` running with the settings below | The LLM chooses which governed tools to call and phrases the answer. **All numbers still come from the tools.** Guardrails run *before* the LLM is called |

The API key never reaches the browser. The browser talks to `server.js` at `/api/llm`, and the server forwards to the provider.

## Option A: Claude (Anthropic Messages API)

```bash
export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=...            # or ANTHROPIC_AUTH_TOKEN for a bearer token
export LLM_MODEL=claude-opus-5          # default
# export LLM_BASE_URL=https://your-approved-gateway   # if the organisation routes Claude through a gateway
node server.js
```

Notes:
- Effort defaults to `medium` (`LLM_EFFORT=low|medium|high` to change).
- On the first-party API the server enables server-side refusal fallbacks (`fallbacks: "default"`). Through a gateway they are off by default. Set `LLM_FALLBACKS=default` or `off` to override.

## Option B: an OpenAI-compatible gateway (e.g. an internal or Azure-hosted endpoint)

```bash
export LLM_PROVIDER=openai
export LLM_BASE_URL=https://<approved-gateway>/v1      # the server calls $LLM_BASE_URL/chat/completions
export LLM_MODEL=<approved-model-name>
export LLM_API_KEY=...
# export LLM_AUTH_HEADER=api-key                        # if the gateway expects an "api-key" header instead of Bearer
node server.js
```

## Verify

- The header pill changes from **"AI: governed engine"** to **"AI: <model>"**.
- LLM answers carry the chip **"phrased by approved LLM · numbers from governed tools"**.
- Ask *"Show me HDFC's delinquency"*. It must be refused, and the LLM is never called (check the audit trail on the Governance page).

## Other settings

`PORT` (default 8080), `HOST` (default 127.0.0.1; use `0.0.0.0` only on a trusted network).
