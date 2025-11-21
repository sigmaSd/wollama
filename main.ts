// main.ts - Ollama-compatible API server with Gemini backend
import { GeminiAdapter } from "./gemini-adapter.ts";
import { setUseDefaultProfile } from "./browser.ts";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import process from "node:process";
import { parseArgs } from "node:util";

// Parse CLI arguments
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    "default-profile": {
      type: "boolean",
      short: "d",
      default: false,
    },
    help: {
      type: "boolean",
      short: "h",
      default: false,
    },
  },
});

if (values.help) {
  console.log(`
Wollama - Web + Ollama

Usage: deno run -A main.ts [options]

Options:
  -d, --default-profile  Use Chrome's default profile (your logged-in account)
  -h, --help             Show this help message

Examples:
  deno run -A main.ts                    # Use temporary profile
  deno run -A main.ts --default-profile  # Use your Chrome account
  deno run -A main.ts -d                 # Short form
`);
  process.exit(0);
}

// Configure browser profile
setUseDefaultProfile(values["default-profile"] ?? false);

const gemini = new GeminiAdapter();

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
}

interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  stream?: boolean;
}

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    // deno-lint-ignore no-explicit-any
    req.on("data", (chunk: any) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, data: object, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const method = req.method || "GET";

  console.log(`[${method}] ${url.pathname}`);

  // Handle CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // Health check
  if (url.pathname === "/") {
    res.writeHead(200);
    res.end("Wollama - Running");
    return;
  }

  // Ollama generate endpoint
  if (url.pathname === "/api/generate" && method === "POST") {
    const body: OllamaGenerateRequest = JSON.parse(await parseBody(req));

    console.log(
      `[Generate] Model: ${body.model}, Prompt length: ${body.prompt.length}`,
    );

    try {
      await gemini.ensureReady();

      let fullPrompt = body.prompt;
      if (body.system) {
        fullPrompt = `${body.system}\n\n${body.prompt}`;
      }

      const response = await gemini.sendMessage(fullPrompt);

      sendJson(res, {
        model: body.model,
        created_at: new Date().toISOString(),
        response: response,
        done: true,
      });
    } catch (error) {
      console.error("[Error]", error);
      sendJson(res, { error: "Generation failed" }, 500);
    }
    return;
  }

  // Ollama chat endpoint
  if (url.pathname === "/api/chat" && method === "POST") {
    const body: OllamaChatRequest = JSON.parse(await parseBody(req));

    console.log(
      `[Chat] Model: ${body.model}, Messages: ${body.messages.length}`,
    );

    try {
      await gemini.ensureReady();

      const systemMsg = body.messages.find((m) => m.role === "system");
      const userMessages = body.messages.filter((m) => m.role !== "system");

      let fullPrompt = "";
      if (systemMsg) {
        fullPrompt = `${systemMsg.content}\n\n`;
      }

      for (const msg of userMessages) {
        fullPrompt += `${msg.role}: ${msg.content}\n`;
      }

      const response = await gemini.sendMessage(fullPrompt);

      sendJson(res, {
        model: body.model,
        created_at: new Date().toISOString(),
        message: {
          role: "assistant",
          content: response,
        },
        done: true,
      });
    } catch (error) {
      console.error("[Error]", error);
      sendJson(res, { error: "Chat failed" }, 500);
    }
    return;
  }

  // Ollama models list endpoint
  if (url.pathname === "/api/tags" && method === "GET") {
    console.log("[Tags] Returning model list");
    sendJson(res, {
      models: [
        {
          name: "gemini-browser",
          model: "gemini-browser",
          modified_at: new Date().toISOString(),
          size: 0,
          digest: "sha256:gemini",
          details: {
            format: "browser",
            family: "gemini",
            families: ["gemini"],
            parameter_size: "0B",
            quantization_level: "browser",
          },
        },
      ],
    });
    return;
  }

  // Ollama show model endpoint
  if (url.pathname === "/api/show" && method === "POST") {
    let modelName = "gemini-browser";
    try {
      const body = JSON.parse(await parseBody(req));
      modelName = body.name || modelName;
    } catch {
      // ignore json parse error
    }

    console.log(`[Show] Model: ${modelName}`);

    sendJson(res, {
      license: "Google",
      modelfile: `FROM gemini-browser\nSYSTEM "You are a helpful assistant."`,
      parameters: "N/A",
      template: `{{ .Prompt }}`,
      details: {
        format: "browser",
        family: "gemini",
        families: ["gemini"],
        parameter_size: "0B",
        quantization_level: "browser",
      },
    });
    return;
  }

  sendJson(res, { error: "Not Found" }, 404);
}

// Create server
const server = createServer(handler);

// Graceful shutdown
async function shutdown() {
  console.log("\n[Server] Shutting down...");
  await gemini.close();
  server.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[Server] Starting on http://localhost:11434");
console.log("[Server] Mode: Remote Debugging (CDP)");
console.log(
  `[Server] Profile: ${
    values["default-profile"] ? "Default Chrome profile" : "Temporary profile"
  }`,
);
console.log("[Server] Ensure Chrome is open on port 9222\n");

server.listen(11434, () => {
  console.log("[Server] Ready to accept connections\n");
});
