// gemini-adapter.ts - Playwright automation for Google Gemini
import { Browser, BrowserContext, Page } from "npm:playwright@1.56.1";
import { closeBrowser, ensureBrowser } from "./browser.ts";

export class GeminiAdapter {
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
    const geminiPage = pages.find((p) => p.url().includes("gemini.google.com"));

    if (geminiPage) {
      console.log("[Gemini] Found existing Gemini tab.");
      this.page = geminiPage;
    } else {
      this.page = pages[0] || (await this.context.newPage());
    }

    this.page.setDefaultTimeout(0);

    if (!this.page.url().includes("gemini.google.com/app")) {
      console.log("[Gemini] Navigating to gemini.google.com...");
      await this.page.goto("https://gemini.google.com/app", {
        waitUntil: "domcontentloaded",
      });
    }

    console.log("[Gemini] Waiting for chat interface...");
    await this.page.waitForSelector(
      'div[role="textbox"][aria-label*="Enter a prompt"]',
      { timeout: 0, state: "visible" },
    );

    console.log("[Gemini] ✓ Connected and Ready!\n");
    this.isReady = true;
  }

  async sendMessage(prompt: string): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized");

    console.log(`[Gemini] Sending message (${prompt.length} chars)...`);

    const inputSelector = 'div[role="textbox"][aria-label*="Enter a prompt"]';
    const input = await this.page.waitForSelector(inputSelector);

    if (!input) throw new Error("Could not find input field");

    await input.click();
    await this.page.waitForTimeout(300);
    await input.fill(prompt);
    await this.page.waitForTimeout(500);

    const sendButton = this.page.locator('button[aria-label*="Send message"]')
      .first();
    await sendButton.click();

    console.log("[Gemini] Message sent, waiting for response...");
    await this.page.waitForTimeout(2000);

    try {
      const stopButton = this.page.locator('button[aria-label*="Stop"]');
      if (await stopButton.isVisible()) {
        await stopButton.waitFor({ state: "hidden", timeout: 0 });
      }
    } catch {
      // Ignore if stop button detection is flaky
    }

    await this.page.waitForTimeout(1000);

    const responses = await this.page.locator(".model-response-text").all();
    if (responses.length === 0) {
      throw new Error("No response found (check browser for captcha/errors)");
    }

    const lastResponse = responses[responses.length - 1];
    const responseText = await lastResponse.innerText();

    console.log(
      `[Gemini] ✓ Response received (${responseText.length} chars)\n`,
    );
    return responseText;
  }

  async close() {
    console.log("[Gemini] Disconnecting adapter...");
    await closeBrowser(this.browser);
    this.browser = null;
    this.isReady = false;
  }
}
