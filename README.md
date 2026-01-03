# Wollama

**⚠️ DISCLAIMER: FOR EDUCATIONAL PURPOSES ONLY** This project automates browser
interactions with web-based LLM interfaces. **This likely violates the Terms of
Service** of various AI providers (Google, OpenAI, Anthropic, etc.), which
prohibit automated access, scraping, and circumventing access controls.

Using this tool may result in:

- Account suspension or permanent ban
- IP blocking
- Legal action from service providers

**Do not use this for production, commercial purposes, or any activity that
could harm others.** If you need programmatic access to these models, use their
official APIs:

- [Gemini API](https://ai.google.dev/) (generous free tier)
- [OpenAI API](https://platform.openai.com/)
- [Anthropic API](https://www.anthropic.com/)

The authors are not responsible for any consequences resulting from the use of
this software.

**Turn your browser into a local AI server.**

[Screencast From 2025-11-21 22-57-19.webm](https://github.com/user-attachments/assets/b77afb9a-6802-49bc-ab94-d0b3cde5172f)

**Wollama** (Web + Ollama) is a bridge that exposes web-based LLM interfaces as
standard local APIs.

Wollama is architected to be model-agnostic. It acts as a universal adapter
layer, allowing you to control _any_ web-based chat interface (like ChatGPT,
Gemini, Claude, or Le Chat) using standard tools designed for
[Ollama](https://ollama.com).

## Mission

To liberate AI models trapped in browser tabs and make them accessible via the
command line, IDE plugins, and local scripts.

## Current Support

| Adapter     | Status    | Description                                  |
| :---------- | :-------- | :------------------------------------------- |
| **Gemini**  | **Ready** | Full support via the `GeminiAdapter` class.  |
| **ChatGPT** | **Ready** | Full support via the `ChatGPTAdapter` class. |
| **Claude**  | _Planned_ | Future support for anthropic.com.            |
| **Le Chat** | _Planned_ | Future support for Mistral AI.               |

## Under the Hood

Wollama uses the **Adapter Design Pattern** to standardize the chaotic world of
DOM manipulation into a clean API.

1. **The Server:** An HTTP server listening on port `11434`.
2. **The Interface:** It mimics the Ollama API (`/api/generate`, `/api/chat`),
   so existing clients (like `ollama run` or VS Code extensions) work out of the
   box.
3. **The Backend:** Instead of running a heavy model file locally, it sends
   instructions to a **Browser Adapter**.
4. **The Adapter:** Uses **Playwright** to drive a live Chrome session, typing
   prompts and scraping responses in real-time.
   - `GeminiAdapter`: Automates gemini.google.com
   - `ChatGPTAdapter`: Automates chatgpt.com with proper code block handling

## Getting Started

1. Prepare Chrome Start Chrome with remote debugging enabled on port 9222: (this
   step is optional)

```bash
google-chrome --remote-debugging-port=9222
```

Ensure you are logged into your target platform (gemini.google.com or
chatgpt.com).

2. Run Wollama

Start the proxy server:

```bash
deno run -A jsr:@sigmasd/wollama
# or
npx rjsr @sigmasd/wollama
# or
bunx rjsr @sigmasd/wollama
```

3. Usage

Interact with it just like a local Ollama model:

**For Gemini:**

```bash
curl -X POST http://localhost:11434/api/generate -d '{
  "model": "gemini-browser",
  "prompt": "Write a haiku about browser automation.",
  "stream": false
}'
```

**For ChatGPT:**

```bash
curl -X POST http://localhost:11434/api/generate -d '{
  "model": "chatgpt-browser",
  "prompt": "Explain the adapter pattern in software design.",
  "stream": false
}'
```

## Gemini Chat CLI

Wollama also includes a standalone CLI tool for Gemini that supports file
uploads (OCR, PDF analysis, images) and parallel execution.

### Usage

Run it directly via JSR:

```bash
deno run -A jsr:@sigmasd/wollama/gemini/chat "Explain this document" -f ./doc.pdf
```

### Options

| Option      | Short | Description                                       |
| :---------- | :---- | :------------------------------------------------ |
| `--prompt`  | `-p`  | The text prompt (default: "Hello")                |
| `--file`    | `-f`  | File(s) to upload (can be used multiple times)    |
| `--quiet`   | `-q`  | Only output the model response (clean output)     |
| `--new-tab` | `-n`  | Open a new tab instead of reusing an existing one |
| `--port`    |       | Browser remote debugging port (default: 9222)     |

### Examples

**OCR and Analysis:**

```bash
deno run -A jsr:@sigmasd/wollama/gemini/chat "OCR this and return text" -f document.pdf
```

**Clean output for piping:**

```bash
deno run -A jsr:@sigmasd/wollama/gemini/chat -q "Summarize" -f data.csv > summary.md
```

**Parallel execution (Isolated tabs):**

```bash
deno run -A jsr:@sigmasd/wollama/gemini/chat -n "Task 1" &
deno run -A jsr:@sigmasd/wollama/gemini/chat -n "Task 2" &
```

## Features

- **Multi-Model Support:** Switch between Gemini and ChatGPT by changing the
  model name
- **Markdown Conversion:** Responses are converted to clean markdown with proper
  code block formatting
- **Ollama Compatible:** Works with any tool that supports Ollama's API
- **Automatic Tab Detection:** Finds existing browser tabs or creates new ones

## Contributing

We welcome contributions! If you want to add support for Claude or other models,
simply implement the Adapter interface and plug it into the main router.

### Adding a New Adapter

1. Create a new file: `your-model-adapter.ts`
2. Implement the adapter interface with `ensureReady()`, `sendMessage()`, and
   `close()` methods
3. Handle DOM-specific selectors for your target platform
4. Add the adapter to the router in the main server file

Readme created by the gemini-browser model and updated for ChatGPT support.
