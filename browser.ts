// browser.ts - Chrome browser management utilities
import { Browser, chromium } from "npm:playwright@1.56.1";
import { ChildProcess, spawn } from "node:child_process";
import { createTempDirSync } from "jsr:@david/temp@0.1.1";
import { rmSync } from "node:fs";

const CDP_URL = "http://localhost:9222";

let chromeProcess: ChildProcess | null = null;
let launchedByUs = false;
// TODO: allow user to choose profile
// unfortunately bun and node don't support using ? (deno does)
// so we're stuck with manual cleanup
const tempDir = createTempDirSync();

export async function isPortOpen(): Promise<boolean> {
  try {
    const res = await fetch(`${CDP_URL}/json/version`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function launchChrome(): Promise<void> {
  console.log("[Browser] Chrome not found, launching with remote debugging...");

  const chromePaths = [
    "google-chrome",
    "google-chrome-stable",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "chromium",
    "chromium-browser",
  ];

  const args = [
    "--remote-debugging-port=9222",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${tempDir}`,
  ];

  for (const chromePath of chromePaths) {
    try {
      chromeProcess = spawn(chromePath, args, {
        detached: true,
        stdio: "ignore",
      });

      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (await isPortOpen()) {
          console.log(`[Browser] ✓ Chrome launched (${chromePath})\n`);
          launchedByUs = true;
          return;
        }
      }
      chromeProcess.kill();
    } catch {
      // Path not found, try next
    }
  }

  throw new Error(
    "Could not launch Chrome. Please start it manually with:\n" +
      "  google-chrome --remote-debugging-port=9222",
  );
}

export async function ensureBrowser(): Promise<Browser> {
  if (!(await isPortOpen())) {
    await launchChrome();
  }
  console.log(`[Browser] Connecting to Chrome at ${CDP_URL}...`);
  return chromium.connectOverCDP(CDP_URL);
}

export async function closeBrowser(browser: Browser | null): Promise<void> {
  if (browser) {
    await browser.close();
  }
  if (launchedByUs && chromeProcess) {
    console.log("[Browser] Closing Chrome instance...");
    chromeProcess.kill();
    chromeProcess = null;
    launchedByUs = false;
  }
  // Clean up temp directory
  rmSync(tempDir.toString(), { recursive: true, force: true });
}
