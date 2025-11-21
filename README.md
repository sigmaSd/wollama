# Wollama

**⚠️ DISCLAIMER: FOR EDUCATIONAL PURPOSES ONLY** This project automates browser
interactions with Google Gemini's web interface (other models planned). **This
likely violates Google's (and others) Terms of Service**, which prohibit
automated access, scraping, and circumventing access controls.

Using this tool may result in:

- Account suspension or permanent ban
- IP blocking
- Legal action from Google

**Do not use this for production, commercial purposes, or any activity that
could harm others.** If you need programmatic access to Gemini, use the
[official Gemini API](https://ai.google.dev/) which has a generous free tier.

The authors are not responsible for any consequences resulting from the use of
this software.

**Turn your browser into a local AI server.**

[Screencast From 2025-11-21 22-57-19.webm](https://github.com/user-attachments/assets/b77afb9a-6802-49bc-ab94-d0b3cde5172f)

**Wollama** (Web + Ollama) is a bridge that exposes web-based LLM interfaces as
standard local APIs.

While it currently powers the **Gemini** experience, Wollama is architected to
be model-agnostic. It acts as a universal adapter layer, allowing you to control
_any_ web-based chat interface (like ChatGPT, Claude, or Le Chat) using standard
tools designed for [Ollama](https://ollama.com).

## Mission

To liberate AI models trapped in browser tabs and make them accessible via the
command line, IDE plugins, and local scripts.

## Current Support

| Adapter     | Status    | Description                                 |
| :---------- | :-------- | :------------------------------------------ |
| **Gemini**  | **Ready** | Full support via the `GeminiAdapter` class. |
| **ChatGPT** | _Planned_ | Architecture ready for implementation.      |
| **Claude**  | _Planned_ | Future support for anthropic.com.           |

## Under the Hood

Wollama uses the **Adapter Design Pattern** to standardize the chaotic world of
DOM manipulation into a clean API.

1. **The Server:** An HTTP server listening on port `11434`.
2. **The Interface:** It mimics the Ollama API (`/api/generate`, `/api/chat`),
   so existing clients (like `ollama run` or VS Code extensions) work out of the
   box.
3. **The Backend:** Instead of running a heavy model file locally, it sends
   instructions to a **Browser Adapter**.
4. **The Adapter:** (Currently `GeminiAdapter`) Uses **Playwright** to drive a
   live Chrome session, typing prompts and scraping responses in real-time.

## Getting Started

1. Prepare Chrome Start Chrome with remote debugging enabled on port 9222:

```bash
google-chrome --remote-debugging-port=9222
```

Ensure you are logged into gemini.google.com (or your target platform).

2. Run Wollama

Start the proxy server:

```
deno run -A jsr:@sigmasd/wollama # or npx xjsr @sigmasd/wollama or bunx xjsr @sigmasd/wollama
```

3. Usage

Interact with it just like a local Ollama model:

Bash curl -X POST http://localhost:11434/api/generate -d '{ "model":
"gemini-browser", "prompt": "Write a haiku about browser automation.", "stream":
false }'

## Contributing

We welcome contributions! If you want to add support for ChatGPT or Claude,
simply implement the Adapter interface and plug it into the main router.

Readme created by the gemini-browser model.
