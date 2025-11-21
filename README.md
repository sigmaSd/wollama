# 🦙 Wollama

**Turn your browser into a local AI server.**

**Wollama** (Web + Ollama) is a bridge that exposes web-based LLM interfaces as standard local APIs.

While it currently powers the **Gemini** experience, Wollama is architected to be model-agnostic. It acts as a universal adapter layer, allowing you to control *any* web-based chat interface (like ChatGPT, Claude, or Le Chat) using standard tools designed for [Ollama](https://ollama.com).

## 🌟 Mission

To liberate AI models trapped in browser tabs and make them accessible via the command line, IDE plugins, and local scripts.

## 🔌 Current Support

| Adapter | Status | Description |
| :--- | :--- | :--- |
| **Gemini** | 🟢 **Ready** | Full support via the `GeminiAdapter` class. |
| **ChatGPT** | 🟡 *Planned* | Architecture ready for implementation. |
| **Claude** | 🟡 *Planned* | Future support for anthropic.com. |

## 🧠 Under the Hood

Wollama uses the **Adapter Design Pattern** to standardize the chaotic world of DOM manipulation into a clean API.

1.  **The Server:** A Deno-based HTTP server listening on port `11434`.
2.  **The Interface:** It mimics the Ollama API (`/api/generate`, `/api/chat`), so existing clients (like `ollama run` or VS Code extensions) work out of the box.
3.  **The Backend:** Instead of running a heavy model file locally, it sends instructions to a **Browser Adapter**.
4.  **The Adapter:** (Currently `GeminiAdapter`) Uses **Playwright** to drive a live Chrome session, typing prompts and scraping responses in real-time.

## 🚀 Getting Started

### 1. Prepare Chrome
Start Chrome with remote debugging enabled on port 9222:
```bash
google-chrome --remote-debugging-port=9222


Ensure you are logged into gemini.google.com (or your target platform).

2. Run Wollama

Start the proxy server:

Bash
deno run --allow-net --allow-read --allow-run main.ts


3. Usage

Interact with it just like a local Ollama model:

Bash
curl -X POST http://localhost:11434/api/generate -d '{
  "model": "gemini-browser",
  "prompt": "Write a haiku about browser automation.",
  "stream": false
}'


## Contributing

We welcome contributions! If you want to add support for ChatGPT or Claude, simply implement the Adapter interface and plug it into the main router.

Readme created by the gemini-browser model.
