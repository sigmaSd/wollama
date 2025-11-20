// main.ts - Ollama-compatible API server with Gemini backend
import { GeminiAdapter } from "./gemini-adapter.ts";

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

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  console.log(`[${req.method}] ${url.pathname}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Health check
  if (url.pathname === "/") {
    return new Response("Browser AI Proxy - Running", { status: 200 });
  }

  // Ollama generate endpoint
  if (url.pathname === "/api/generate" && req.method === "POST") {
    const body: OllamaGenerateRequest = await req.json();

    console.log(
      `[Generate] Model: ${body.model}, Prompt length: ${body.prompt.length}`,
    );

    try {
      await gemini.ensureReady();

      // Combine system prompt if provided
      let fullPrompt = body.prompt;
      if (body.system) {
        fullPrompt = `${body.system}\n\n${body.prompt}`;
      }

      // Send to Gemini
      const response = await gemini.sendMessage(fullPrompt);

      // Return in Ollama format
      return new Response(
        JSON.stringify({
          model: body.model,
          created_at: new Date().toISOString(),
          response: response,
          done: true,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    } catch (error) {
      console.error("[Error]", error);
      return new Response(JSON.stringify({ error: "Generation failed" }), {
        status: 500,
      });
    }
  }

  // Ollama chat endpoint
  if (url.pathname === "/api/chat" && req.method === "POST") {
    const body: OllamaChatRequest = await req.json();

    console.log(
      `[Chat] Model: ${body.model}, Messages: ${body.messages.length}`,
    );

    try {
      await gemini.ensureReady();

      // Convert messages to a single prompt
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

      return new Response(
        JSON.stringify({
          model: body.model,
          created_at: new Date().toISOString(),
          message: {
            role: "assistant",
            content: response,
          },
          done: true,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    } catch (error) {
      console.error("[Error]", error);
      return new Response(JSON.stringify({ error: "Chat failed" }), {
        status: 500,
      });
    }
  }

  // Ollama models list endpoint
  if (url.pathname === "/api/tags" && req.method === "GET") {
    console.log("[Tags] Returning model list");
    return new Response(
      JSON.stringify({
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
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  // Ollama show model endpoint (RESTORED)
  if (url.pathname === "/api/show" && req.method === "POST") {
    // We use a try/catch for body parsing just in case the client sends empty body
    let modelName = "gemini-browser";
    try {
      const body = await req.json();
      modelName = body.name || modelName;
    } catch {
      // ignore json parse error
    }

    console.log(`[Show] Model: ${modelName}`);

    return new Response(
      JSON.stringify({
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
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  return new Response(
    JSON.stringify({ error: "Not Found" }),
    {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

// Graceful shutdown
const controller = new AbortController();

Deno.addSignalListener("SIGINT", async () => {
  console.log("\n[Server] Shutting down...");
  await gemini.close();
  controller.abort();
  Deno.exit(0);
});

console.log("[Server] Starting on http://localhost:11434");
console.log("[Server] Mode: Remote Debugging (CDP)");
console.log("[Server] Ensure Chrome is open on port 9222\n");

Deno.serve({
  port: 11434,
  signal: controller.signal,
  onListen: () => console.log("[Server] Ready to accept connections\n"),
}, handler);
