// gemini-adapter.ts - Playwright automation for Google Gemini
import { Browser, BrowserContext, Page } from "npm:playwright@1.56.1";
import {
  closeBrowser,
  ensureBrowser,
  setUseDefaultProfile,
} from "./browser.ts";
import TurndownService from "npm:turndown@7.2.2";

// Initialize Turndown with fenced code blocks
const turndown = new TurndownService({
  codeBlockStyle: "fenced",
  headingStyle: "atx",
  bulletListMarker: "-",
});

// Custom rule for Gemini's <code-block> elements
turndown.addRule("geminiCodeBlock", {
  // deno-lint-ignore no-explicit-any
  filter: (node: any) => node.nodeName.toLowerCase() === "code-block",
  // deno-lint-ignore no-explicit-any
  replacement: (_content: any, node: any) => {
    // deno-lint-ignore no-explicit-any
    const el = node as any;
    const langSpan = el.querySelector(".code-block-decoration span");
    const codeEl = el.querySelector('code[data-test-id="code-content"]');

    let lang = langSpan?.textContent?.trim().toLowerCase() || "";
    if (lang === "code snippet") lang = "";

    const code = codeEl?.textContent || "";
    return `\n\n\`\`\`${lang}\n${code.trim()}\n\`\`\`\n\n`;
  },
});

// Skip the response-element wrapper
turndown.addRule("responseElement", {
  // deno-lint-ignore no-explicit-any
  filter: (node: any) => node.nodeName.toLowerCase() === "response-element",
  // deno-lint-ignore no-explicit-any
  replacement: (content: any) => content,
});

export class GeminiAdapter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isReady = false;

  async ensureReady(
    options: { port?: number; newTab?: boolean; defaultProfile?: boolean } = {},
  ) {
    if (this.isReady && this.page) return;

    if (options.defaultProfile !== undefined) {
      setUseDefaultProfile(options.defaultProfile);
    }

    const port = options.port || 9222;
    this.browser = await ensureBrowser(port);

    const contexts = this.browser.contexts();
    if (contexts.length === 0) throw new Error("No browser context found");
    this.context = contexts[0];

    const pages = this.context.pages();
    const geminiPage = options.newTab
      ? null
      : pages.find((p) => p.url().includes("gemini.google.com"));

    if (geminiPage) {
      console.log("[Gemini] Found existing Gemini tab.");
      this.page = geminiPage;
    } else {
      console.log("[Gemini] Opening new Gemini tab...");
      this.page = await this.context.newPage();
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

  async sendMessage(prompt: string, files: string[] = []): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized");

    if (files.length > 0) {
      console.log(`[Gemini] Uploading ${files.length} files...`);

      // 1. Click the plus button to open the menu
      const plusButton = this.page.locator(
        'button[aria-label="Open upload file menu"]',
      );
      await plusButton.click();

      // 2. Wait for the menu to appear and finding the upload button
      // Using the user-provided test-id for precision
      const uploadButton = this.page.locator(
        'button[data-test-id="local-images-files-uploader-button"]',
      );
      await uploadButton.waitFor({ state: "visible" });

      // 3. Prepare for file chooser and click the upload button
      const fileChooserPromise = this.page.waitForEvent("filechooser");
      await uploadButton.click();
      const fileChooser = await fileChooserPromise;

      // 4. Set the files
      await fileChooser.setFiles(files);

      await this.page.waitForTimeout(5000); // Wait for upload to process (increased to 5s)
    }

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

    // Get the HTML and convert to markdown
    // deno-lint-ignore no-explicit-any
    const html = await lastResponse.evaluate((el: any) => {
      const markdown = el.querySelector(".markdown");
      return markdown?.innerHTML || el.innerHTML;
    });

    const responseText = turndown.turndown(html);

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
