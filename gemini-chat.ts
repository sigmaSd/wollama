import { GeminiAdapter } from "./gemini-adapter.ts";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import process from "node:process";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    prompt: {
      type: "string",
      short: "p",
    },
    file: {
      type: "string",
      short: "f",
      multiple: true,
    },
    help: {
      type: "boolean",
      short: "h",
    },
    quiet: {
      type: "boolean",
      short: "q",
    },
    port: {
      type: "string",
    },
    "new-tab": {
      type: "boolean",
      short: "n",
    },
    "keep-alive": {
      type: "boolean",
      short: "k",
    },
    "default-profile": {
      type: "boolean",
    },
  },
  allowPositionals: true,
});

if (values.quiet) {
  console.log = () => {};
}

if (values.help) {
  process.stdout.write(`
Gemini Chat Tool (Wollama)

Usage: 
  deno run -A jsr:@sigmasd/wollama/gemini/chat [options] [prompt] [files...]
  # or
  deno run -A gemini-chat.ts [options] [prompt] [files...]

Options:
  -p, --prompt <text>   The prompt to send (default: "Hello")
  -f, --file <path>     File(s) to upload (can be used multiple times)
  -q, --quiet           Only output the model response
  -n, --new-tab         Open a new tab instead of reusing an existing one
  -k, --keep-alive      Keep the browser open after the chat is done
  --default-profile     Use the default Chrome profile instead of a temporary one
  --port <number>       Browser remote debugging port (default: 9222)
  -h, --help            Show this help message

Examples:
  deno run -A gemini-chat.ts "How are you?"
  deno run -A gemini-chat.ts -n "Start a fresh chat"
  deno run -A gemini-chat.ts --port 9223 "Isolated browser instance"
  deno run -A gemini-chat.ts -f ./image.png "What is in this image?"
`);
  process.exit(0);
}

const prompt = values.prompt || positionals[0] || "Hello";

// Collect files from --file and remaining positionals
let files: string[] = [];
if (values.file) {
  files = Array.isArray(values.file) ? values.file : [values.file];
}

// If prompt was positional[0], then files start at 1.
let startPos = 0;
if (!values.prompt && positionals.length > 0) {
  startPos = 1;
}
files.push(...positionals.slice(startPos));

// Resolve paths
const absFiles = files.map((f) => resolve(process.cwd(), f));

console.log(`Prompt: "${prompt}"`);
if (absFiles.length > 0) {
  console.log(`Files: ${absFiles.join(", ")}`);
}

const adapter = new GeminiAdapter();

try {
  await adapter.ensureReady({
    port: values.port ? parseInt(values.port) : undefined,
    newTab: values["new-tab"],
    defaultProfile: values["default-profile"],
  });
  const response = await adapter.sendMessage(prompt, absFiles);
  if (values.quiet) {
    process.stdout.write(response + "\n");
  } else {
    process.stdout.write("\n--- Response ---\n\n");
    process.stdout.write(response + "\n");
  }
} catch (error) {
  process.stderr.write(`Error: ${error}\n`);
  process.exit(1);
} finally {
  if (!values["keep-alive"]) {
    await adapter.close();
  }
  process.exit(0);
}
