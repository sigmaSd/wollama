import { GeminiAdapter } from "../gemini-adapter.ts";
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
  },
  allowPositionals: true,
});

if (values.quiet) {
  console.log = () => {};
}

if (values.help) {
  process.stdout.write(`
Gemini OCR Tool

Usage: deno run -A scripts/ocr.ts [options] [prompt] [files...]

Options:
  -p, --prompt <text>   The prompt to send (default: "OCR this file and return the text")
  -f, --file <path>     File(s) to upload (can be used multiple times)
  -q, --quiet           Only output the model response
  -h, --help            Show this help message

Examples:
  deno run -A scripts/ocr.ts -f ./doc.pdf
  deno run -A scripts/ocr.ts -q -f ./doc.pdf > output.md
  deno run -A scripts/ocr.ts "Summarize this" ./doc.pdf
`);
  process.exit(0);
}

const prompt = values.prompt || positionals[0] ||
  "OCR this file and return the text";

// Collect files from --file and remaining positionals
let files: string[] = [];
if (values.file) {
  files = Array.isArray(values.file) ? values.file : [values.file];
}

// If prompt was positional[0], then files start at 1.
// If prompt was via flag, files might be at 0.
// Heuristic: if positionals[0] is used as prompt, take slice(1).
// If positionals[0] seems to be a file (and prompt is set via flag), take slice(0).
// But for simplicity, let's say if prompt is NOT from flag, it consumes pos[0].
let startPos = 0;
if (!values.prompt && positionals.length > 0) {
  startPos = 1;
}
files.push(...positionals.slice(startPos));

if (files.length === 0) {
  process.stderr.write(
    "Error: No files provided. Use -f or pass file paths as arguments.\n",
  );
  process.exit(1);
}

// Resolve paths
const absFiles = files.map((f) => resolve(process.cwd(), f));

console.log(`Prompt: "${prompt}"`);
console.log(`Files: ${absFiles.join(", ")}`);

const adapter = new GeminiAdapter();

try {
  await adapter.ensureReady();
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
  await adapter.close();
  process.exit(0);
}
