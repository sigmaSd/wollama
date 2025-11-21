/// <reference lib="dom" />
// debug-selectors.ts
import { chromium } from "npm:playwright@1.56.1";

console.log("Connecting to Chrome...");
const browser = await chromium.connectOverCDP("http://localhost:9222");
const context = browser.contexts()[0];
const page = context.pages().find((p) => p.url().includes("gemini.google.com"));

if (!page) {
  console.error(
    "❌ Gemini tab not found! Please open Gemini in the browser first.",
  );
  await browser.close();
  Deno.exit(1);
}

console.log(`✓ Found Gemini tab: ${await page.title()}`);

// Wait a moment for hydration
await page.waitForTimeout(2000);

// 1. Search for common input candidates
console.log("\n--- SCANNING FOR INPUTS ---");

const candidates = await page.evaluate(() => {
  // deno-lint-ignore no-explicit-any
  const inputs: any = [];

  // Check for contenteditable divs (often used for rich text)
  document.querySelectorAll('[contenteditable="true"]').forEach((el) => {
    inputs.push({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role"),
      ariaLabel: el.getAttribute("aria-label"),
      placeholder: el.getAttribute("placeholder"),
      classes: el.className,
    });
  });

  // Check for textareas
  document.querySelectorAll("textarea").forEach((el) => {
    inputs.push({
      tag: "textarea",
      ariaLabel: el.getAttribute("aria-label"),
      placeholder: el.getAttribute("placeholder"),
      id: el.id,
    });
  });

  // Check for the specific rich-textarea element
  document.querySelectorAll("rich-textarea").forEach((el) => {
    inputs.push({
      tag: "rich-textarea",
      ariaLabel: el.getAttribute("aria-label"),
      id: el.id,
    });
  });

  return inputs;
});

if (candidates.length === 0) {
  console.log(
    "❌ No obvious input fields found. The interface might be inside a Shadow DOM or iframe.",
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

// 2. Try to pinpoint the 'Send' button while we are at it
const buttons = await page.evaluate(() => {
  return Array.from(
    document.querySelectorAll(
      'button[aria-label*="Send"], mat-icon[data-mat-icon-name="send"]',
    ),
  )
    .map((el) => ({
      tag: el.tagName,
      ariaLabel: el.getAttribute("aria-label"),
      classes: el.className,
    }));
});

console.log(`\nFound ${buttons.length} potential Send buttons:`, buttons);

console.log("\n--- END DIAGNOSIS ---");
await browser.close();
