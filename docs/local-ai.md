# Owner-only Neon AI

Double-click `Start Neon AI.cmd` on Windows, or run `npm run ai` from this repository. Install Ollama from its official website first if the launcher reports it is missing. Node 22 or later is required. The supplied launcher can also use the Codex bundled Node runtime when available.

The launcher starts a local Ollama runtime and the companion, downloads `qwen3:1.7b` once if needed, and leaves both running in the background. Open Neon through the accounts portal, sign in as an owner, open Neon AI, then choose **Connect local AI**. Your browser may ask permission to connect to your local computer. Keep the computer on and start the launcher again after rebooting. The model is a separate local AI, not this Codex conversation.

There are no provider message quotas or API charges for this local model. Hardware speed, memory and context limits still apply. It supports text only. Chat history is stored separately per owner account in this browser; it does not sync across devices. Clearing site data removes that history, so use Export to keep a copy.

The account page checks the owner RPC before every request and keeps the bearer token out of the arcade origin. The loopback companion independently verifies the live user and owner RPC for both status and chat requests. It binds only to `127.0.0.1:11435`, accepts only the production accounts origin or local accounts origin, validates its Host header, and has bounded input, timeout, one-generation concurrency, cancellation and output. Browser-generated origins are checked before any model request. The fixed Ollama endpoint is `127.0.0.1:11434`; no client-selected URL or model is accepted. The old public `/api/chat` provider route is retired.

AI does not browse or control your computer. The model's network access is not exposed through Neon. Logs and portable runtime files are under `~/.local/share/neon-ai`. Deploying Neon does not host the model; access from another device needs a separately secured hosting design.

Verification on 2026-10-22: all 552 automated tests and both app/account builds pass. The local model generated a live reply; the running companion rejected an unauthenticated request with 401. Browser preview confirmed that standalone access does not expose the chat. The complete owner account → browser → companion → model flow still needs an owner sign-in to finish its live browser check. The model supports text; screenshot and screen-sharing controls are hidden for this connection. Owner verification requires internet access even though inference runs locally.
