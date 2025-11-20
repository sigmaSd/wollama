// main.ts - Ollama-compatible API server with Gemini backend
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
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

    // Ensure browser is ready
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
  }

  // Ollama chat endpoint
  if (url.pathname === "/api/chat" && req.method === "POST") {
    const body: OllamaChatRequest = await req.json();

    console.log(
      `[Chat] Model: ${body.model}, Messages: ${body.messages.length}`,
    );

    // Ensure browser is ready
    await gemini.ensureReady();

    // Convert messages to a single prompt
    // Extract system message if present
    const systemMsg = body.messages.find((m) => m.role === "system");
    const userMessages = body.messages.filter((m) => m.role !== "system");

    // Build conversation context
    let fullPrompt = "";
    if (systemMsg) {
      fullPrompt = `${systemMsg.content}\n\n`;
    }

    // Add conversation history
    for (const msg of userMessages) {
      fullPrompt += `${msg.role}: ${msg.content}\n`;
    }

    // Send to Gemini
    const response = await gemini.sendMessage(fullPrompt);

    // Return in Ollama format
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
console.log("[Server] Compatible with Ollama API");
console.log("[Server] Using Gemini via Playwright\n");

await serve(handler, {
  port: 11434,
  signal: controller.signal,
  onListen: () => console.log("[Server] Ready to accept connections\n"),
});
