// -- file: scripts/chatgpt-debug.ts --
/// <reference lib="dom" />
// chatgpt-debug.ts
import { chromium } from "npm:playwright@1.56.1";

console.log("Connecting to Chrome...");
const browser = await chromium.connectOverCDP("http://localhost:9222");
const context = browser.contexts()[0];
const page = context.pages().find((p) => p.url().includes("chatgpt.com"));

if (!page) {
  console.error(
    "❌ ChatGPT tab not found! Please open chatgpt.com in the browser first.",
  );
  await browser.close();
  Deno.exit(1);
}

console.log(`✓ Found ChatGPT tab: ${await page.title()}`);

// Wait a moment for hydration
await page.waitForTimeout(2000);

// 1. Search for common input candidates (ChatGPT usually uses a textarea)
console.log("\n--- SCANNING FOR INPUTS ---");

const candidates = await page.evaluate(() => {
  // deno-lint-ignore no-explicit-any
  const inputs: any = [];

  // 1. Check for the main prompt textarea (common selector)
  document.querySelectorAll("textarea").forEach((el) => {
    if (
      el.id === "prompt-textarea" || el.placeholder?.includes("Message ChatGPT")
    ) {
      inputs.push({
        tag: "textarea",
        id: el.id,
        ariaLabel: el.getAttribute("aria-label"),
        placeholder: el.placeholder,
        classes: el.className,
      });
    }
  });

  // 2. Check for contenteditable divs as a fallback (less common for ChatGPT)
  document.querySelectorAll('[contenteditable="true"]').forEach((el) => {
    inputs.push({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role"),
      ariaLabel: el.getAttribute("aria-label"),
      classes: el.className,
    });
  });

  return inputs;
});

if (candidates.length === 0) {
  console.log(
    "❌ No obvious input fields found. Look for a 'prompt-textarea' id or 'Message ChatGPT' placeholder.",
  );
} else {
  console.log(`Found ${candidates.length} potential input fields:\n`);
  // deno-lint-ignore no-explicit-any
  candidates.forEach((c: any, i: any) => {
    console.log(`Candidate #${i + 1}:`);
    console.log(c);
    console.log("--------------------------------");
  });
}

// 2. Try to pinpoint the 'Send' button
const buttons = await page.evaluate(() => {
  return Array.from(
    document.querySelectorAll(
      'button[data-testid="send-button"], button[title="Send message"], button svg.icon-arrow-up',
    ),
  )
    .map((el) => ({
      tag: el.tagName,
      dataTestId: el.getAttribute("data-testid"),
      title: el.getAttribute("title"),
      classes: el.className,
    }));
});

console.log(`\nFound ${buttons.length} potential Send buttons:`, buttons);

// 3. Scan for response elements
console.log("\n--- SCANNING FOR RESPONSE ELEMENTS ---");
const responseElements = await page.evaluate(() => {
  // Common selectors for the response container (usually a markdown component)
  const selectors = [
    'div[data-testid*="conversation-turn"] .markdown', // The main markdown content
    "div.text-token-group .markdown", // Another common pattern
  ];

  const responses: Array<string> = [];
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      responses.push(selector + " | Length: " + el.textContent?.length);
    });
  });
  return responses;
});

console.log(`Found ${responseElements.length} response markdown elements:`);
// deno-lint-ignore no-explicit-any
responseElements.forEach((r: any) => console.log(`- ${r}`));

console.log("\n--- END DIAGNOSIS ---");
await browser.close();
