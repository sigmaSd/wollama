// gemini-adapter.ts - Playwright automation for Google Gemini
import { Browser, BrowserContext, chromium, Page } from "npm:playwright@1.56.1";

export class GeminiAdapter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isReady = false;

  // Default Chrome remote debugging port
  private cdpUrl = "http://localhost:9222";

  async ensureReady() {
    if (this.isReady && this.page) return;

    console.log(`[Gemini] Connecting to Chrome at ${this.cdpUrl}...`);

    try {
      this.browser = await chromium.connectOverCDP(this.cdpUrl);
      const contexts = this.browser.contexts();
      if (contexts.length === 0) throw new Error("No browser context found");
      this.context = contexts[0];

      // Find existing Gemini tab or create new
      const pages = this.context.pages();
      const geminiPage = pages.find((p) =>
        p.url().includes("gemini.google.com")
      );

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

      // Wait for the specific input found in your debug script
      console.log("[Gemini] Waiting for chat interface...");

      // TARGET: Candidate #1 from your debug log
      await this.page.waitForSelector(
        'div[role="textbox"][aria-label*="Enter a prompt"]',
        {
          timeout: 0,
          state: "visible",
        },
      );

      console.log("[Gemini] ✓ Connected and Ready!\n");
      this.isReady = true;
    } catch (error) {
      console.error(`[Gemini] Connection Failed: ${error}`);
      throw error;
    }
  }

  async sendMessage(prompt: string): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized");

    console.log(`[Gemini] Sending message (${prompt.length} chars)...`);
    await this.page.bringToFront();

    // UPDATED SELECTOR based on your debug output
    const inputSelector = 'div[role="textbox"][aria-label*="Enter a prompt"]';
    const input = await this.page.waitForSelector(inputSelector);

    if (!input) throw new Error("Could not find input field");

    // Click and Fill
    await input.click();
    await this.page.waitForTimeout(300);

    // For "contenteditable" divs, .fill() sometimes works better than .type()
    // providing the prompt doesn't contain special key commands
    await input.fill(prompt);

    await this.page.waitForTimeout(500);

    // Find Send button - Candidate #1 from your debug log
    const sendButton = this.page.locator('button[aria-label*="Send message"]')
      .first();
    await sendButton.click();

    console.log("[Gemini] Message sent, waiting for response...");
    await this.page.waitForTimeout(2000);

    // Wait for generation to finish
    // We assume generation is running if we see a Stop button
    try {
      const stopButton = this.page.locator('button[aria-label*="Stop"]');
      if (await stopButton.isVisible()) {
        // Wait until it disappears
        await stopButton.waitFor({ state: "hidden", timeout: 0 });
      }
    } catch {
      // Ignore if stop button detection is flaky
    }

    // Wait a bit more for the text to settle
    await this.page.waitForTimeout(1000);

    // Get Response
    const responses = await this.page.locator(".model-response-text").all();
    if (responses.length === 0) {
      // Fallback: sometimes errors appear in a different container
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
    if (this.browser) await this.browser.close();
    this.isReady = false;
  }
}
