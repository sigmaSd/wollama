// chatgpt-adapter.ts - Playwright automation for ChatGPT
import { Browser, BrowserContext, Page } from "npm:playwright@1.56.1";
import { closeBrowser, ensureBrowser } from "./browser.ts";
import TurndownService from "npm:turndown@7.2.2";

// Initialize Turndown
const turndown = new TurndownService({
  codeBlockStyle: "fenced",
  headingStyle: "atx",
  bulletListMarker: "-",
});

// --- CUSTOM RULE FOR CHATGPT CODE BLOCKS ---
// The DOM shows code blocks are <pre> containing a header (language) + button + code
turndown.addRule("chatgptCodeBlock", {
  filter: "pre",
  // deno-lint-ignore no-explicit-any
  replacement: (_content: string, node: any) => {
    // deno-lint-ignore no-explicit-any
    const el = node as any;

    // 1. Try to find the language. In your DOM it's often in a div with text-xs
    // e.g. <div class="... text-xs ...">javascript</div>
    const langEl = el.querySelector('div[class*="text-xs"]');
    let lang = langEl ? langEl.textContent?.trim().toLowerCase() : "";
    if (lang === "copy code") lang = ""; // Safety check

    // 2. Find the actual code element
    const codeEl = el.querySelector("code");
    if (!codeEl) return "\n```\n" + el.textContent + "\n```\n";

    // 3. Return clean markdown
    return `\n\`\`\`${lang}\n${codeEl.textContent}\n\`\`\`\n\n`;
  },
});

export class ChatGPTAdapter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isReady = false;

  async ensureReady() {
    if (this.isReady && this.page) return;

    this.browser = await ensureBrowser();
    const contexts = this.browser.contexts();
    if (contexts.length === 0) throw new Error("No browser context found");
    this.context = contexts[0];

    const pages = this.context.pages();
    const chatGPTPage = pages.find((p) => p.url().includes("chatgpt.com"));

    if (chatGPTPage) {
      console.log("[ChatGPT] Found existing ChatGPT tab.");
      this.page = chatGPTPage;
    } else {
      this.page = pages[0] || (await this.context.newPage());
    }

    this.page.setDefaultTimeout(0);

    if (!this.page.url().includes("chatgpt.com")) {
      console.log("[ChatGPT] Navigating to chatgpt.com...");
      await this.page.goto("https://chatgpt.com", {
        waitUntil: "domcontentloaded",
      });
    }

    console.log("[ChatGPT] Waiting for input...");
    // Wait for the prose-mirror input div
    await this.page.waitForSelector('div[contenteditable="true"]', {
      timeout: 0,
      state: "visible",
    });

    console.log("[ChatGPT] ✓ Connected and Ready!\n");
    this.isReady = true;
  }

  async sendMessage(prompt: string): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized");

    console.log(`[ChatGPT] Sending message (${prompt.length} chars)...`);

    const inputSelector = 'div[contenteditable="true"]';
    const input = await this.page.waitForSelector(inputSelector);

    if (!input) throw new Error("Could not find input field");

    await input.click();
    await this.page.waitForTimeout(200);
    await input.fill(prompt);

    console.log("[ChatGPT] Waiting for Send button...");
    // The send button usually has data-testid="send-button"
    const sendButtonSelector = 'button[data-testid="send-button"]';
    const sendButton = await this.page.waitForSelector(sendButtonSelector, {
      state: "visible",
      timeout: 5000,
    });

    if (!sendButton) throw new Error("Send button did not appear");

    await sendButton.click();

    console.log("[ChatGPT] Message sent, waiting for response...");

    // Wait for generation to finish.
    // Strategy: Wait for the "Stop generating" button to disappear.
    // Based on common ChatGPT DOM, the stop button usually has aria-label="Stop generating"
    try {
      const stopButton = this.page.locator('button[aria-label*="Stop"]');
      // It might take a split second to appear
      await stopButton.waitFor({ state: "visible", timeout: 3000 }).catch(
        () => {},
      );
      // Now wait for it to be gone
      await stopButton.waitFor({ state: "hidden", timeout: 0 });
    } catch {
      // Fallback just in case
      await this.page.waitForTimeout(3000);
    }

    await this.page.waitForTimeout(500); // Extra breath for rendering

    // --- NEW RESPONSE SELECTOR STRATEGY ---
    // Based on your DOM: <div data-message-author-role="assistant" ...>
    const responses = await this.page.locator(
      'div[data-message-author-role="assistant"]',
    ).all();

    if (responses.length === 0) {
      throw new Error("No assistant response found in DOM.");
    }

    // Get the last one (the one we just generated)
    const lastResponse = responses[responses.length - 1];

    // Find the markdown container inside
    const markdownContent = lastResponse.locator(".markdown");

    if (await markdownContent.count() === 0) {
      // Fallback: return the whole text of the node if markdown class is missing
      return await lastResponse.innerText();
    }

    // Get inner HTML so we can process the code blocks with Turndown
    // deno-lint-ignore no-explicit-any
    const html = await markdownContent.evaluate((el: any) => el.innerHTML);

    const responseText = turndown.turndown(html);

    console.log(
      `[ChatGPT] ✓ Response received (${responseText.length} chars)\n`,
    );
    return responseText;
  }

  async close() {
    console.log("[ChatGPT] Disconnecting adapter...");
    await closeBrowser(this.browser);
    this.browser = null;
    this.isReady = false;
  }
}
