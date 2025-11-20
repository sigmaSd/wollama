// gemini-adapter.ts - Playwright automation for Google Gemini
import { Browser, chromium, Page } from "npm:playwright@1.56.1";

export class GeminiAdapter {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isReady = false;

  async ensureReady() {
    if (this.isReady && this.page) {
      return;
    }

    console.log("[Gemini] Launching browser...");

    // Launch browser with persistent context to save login
    this.browser = await chromium.launch({
      executablePath: "/usr/bin/google-chrome",
      headless: false, // Set to true for production
      args: ["--no-sandbox"],
      timeout: 0,
    });

    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(0);

    // Navigate to Gemini
    console.log("[Gemini] Navigating to gemini.google.com...");
    await this.page.goto("https://gemini.google.com/app", {
      waitUntil: "networkidle",
      timeout: 0,
    });

    // Wait a bit for any redirects
    await this.page.waitForTimeout(2000);

    // Check if we need to login
    const currentUrl = this.page.url();
    if (currentUrl.includes("accounts.google.com")) {
      console.log("[Gemini] ⚠️  Login required!");
      console.log("[Gemini] Please login in the browser window...");
      console.log("[Gemini] Waiting for you to complete login...\n");

      // Wait for navigation back to Gemini (max 5 minutes)
      await this.page.waitForURL("**/gemini.google.com/**", {
        timeout: 0,
      });

      console.log("[Gemini] ✓ Login successful!");
      await this.page.waitForTimeout(3000);
    }

    // Wait for the chat interface to be ready
    console.log("[Gemini] Waiting for chat interface...");

    // Look for the input textarea
    await this.page.waitForSelector(
      'rich-textarea[aria-label*="Enter a prompt"]',
      {
        timeout: 0,
        state: "visible",
      },
    );

    console.log("[Gemini] ✓ Ready to chat!\n");
    this.isReady = true;
  }

  async sendMessage(prompt: string): Promise<string> {
    if (!this.page) {
      throw new Error("Browser not initialized");
    }

    console.log(`[Gemini] Sending message (${prompt.length} chars)...`);

    // Find the input area - Gemini uses a rich-textarea component
    const inputSelector = 'rich-textarea[aria-label*="Enter a prompt"]';
    const input = await this.page.waitForSelector(inputSelector);

    if (!input) {
      throw new Error("Could not find input field");
    }

    // Click to focus
    await input.click();
    await this.page.waitForTimeout(500);

    // Type the message
    await input.fill(prompt);
    await this.page.waitForTimeout(500);

    // Find and click send button
    // Gemini's send button is usually in a button with specific aria-label
    const sendButton = this.page.locator(
      'button[aria-label*="Send message"]',
    ).first();
    await sendButton.click();

    console.log("[Gemini] Message sent, waiting for response...");

    // Wait for response to appear
    // Gemini shows responses in message-content divs
    await this.page.waitForTimeout(2000);

    // Wait for the response to be complete (no loading indicator)
    // Look for the stop button to disappear, which means generation is done
    try {
      await this.page.waitForSelector('button[aria-label*="Stop"]', {
        state: "hidden",
        timeout: 0, // 2 minutes max
      });
    } catch {
      // If stop button wasn't found, continue anyway
      console.log("[Gemini] No stop button found, proceeding...");
    }

    // Get the latest response
    // Gemini responses are in markdown-it containers
    const responses = await this.page.locator(".model-response-text").all();

    if (responses.length === 0) {
      throw new Error("No response found");
    }

    // Get the last response
    const lastResponse = responses[responses.length - 1];
    const responseText = await lastResponse.innerText();

    console.log(
      `[Gemini] ✓ Response received (${responseText.length} chars)\n`,
    );

    return responseText;
  }

  async close() {
    console.log("[Gemini] Closing browser...");
    if (this.browser) {
      await this.browser.close();
    }
    this.isReady = false;
  }
}
