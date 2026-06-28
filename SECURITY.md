# Security Policy

The canonical Magnexis security guidance lives in [docs/SECURITY.md](docs/SECURITY.md).

## Reporting

Please do not include:

- API keys
- Supabase tokens
- access tokens or refresh tokens
- private repository code you do not intend to share
- exported run logs that may still contain sensitive prompts or paths

## Product Expectations

- Magnexis is local-first and approval-first.
- Provider keys and sessions must stay in secure storage.
- Sensitive files and risky commands must stay behind explicit approval.
- OAuth must use the system browser and validated callback state.

For implementation details and trust boundaries, use [docs/SECURITY.md](docs/SECURITY.md).
