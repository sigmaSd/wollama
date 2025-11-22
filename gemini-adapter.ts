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
    const responseText = await this.extractFormattedResponse(lastResponse);

    console.log(
      `[Gemini] ✓ Response received (${responseText.length} chars)\n`,
    );
    return responseText;
  }

  private async extractFormattedResponse(
    // deno-lint-ignore no-explicit-any
    responseElement: any,
  ): Promise<string> {
    // Extract the response with proper markdown formatting for code blocks
    return await responseElement.evaluate((el: HTMLElement) => {
      const result: string[] = [];
      const container = el.querySelector(".markdown");
      if (!container) return el.innerText;

      // Language mapping for common labels
      const langMap: Record<string, string> = {
        "code snippet": "",
        "bash": "bash",
        "shell": "bash",
        "python": "python",
        "javascript": "javascript",
        "typescript": "typescript",
        "json": "json",
        "html": "html",
        "css": "css",
        "sql": "sql",
        "java": "java",
        "c++": "cpp",
        "c": "c",
        "go": "go",
        "rust": "rust",
        "ruby": "ruby",
        "php": "php",
        "yaml": "yaml",
        "xml": "xml",
        "markdown": "markdown",
      };

      function processNode(node: Node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || "";
          if (text.trim()) result.push(text);
          return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const elem = node as HTMLElement;
        const tag = elem.tagName.toLowerCase();

        // Handle code blocks
        if (tag === "code-block") {
          const langSpan = elem.querySelector(".code-block-decoration span");
          const codeEl = elem.querySelector(
            'code[data-test-id="code-content"]',
          );

          if (codeEl) {
            const rawLang = langSpan?.textContent?.trim().toLowerCase() || "";
            const lang = langMap[rawLang] ?? rawLang;
            const code = codeEl.textContent || "";

            result.push(`\n\`\`\`${lang}\n${code.trim()}\n\`\`\`\n`);
          }
          return;
        }

        // Handle inline code
        if (tag === "code" && !elem.closest("code-block")) {
          result.push(`\`${elem.textContent}\``);
          return;
        }

        // Handle headers
        if (tag === "h1") {
          result.push(`\n# ${elem.textContent}\n`);
          return;
        }
        if (tag === "h2") {
          result.push(`\n## ${elem.textContent}\n`);
          return;
        }
        if (tag === "h3") {
          result.push(`\n### ${elem.textContent}\n`);
          return;
        }

        // Handle paragraphs
        if (tag === "p") {
          const parts: string[] = [];
          // @ts-ignore works
          for (const child of elem.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
              parts.push(child.textContent || "");
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              const childEl = child as HTMLElement;
              const childTag = childEl.tagName.toLowerCase();
              if (childTag === "code") {
                parts.push(`\`${childEl.textContent}\``);
              } else if (childTag === "b" || childTag === "strong") {
                parts.push(`**${childEl.textContent}**`);
              } else if (childTag === "i" || childTag === "em") {
                parts.push(`*${childEl.textContent}*`);
              } else {
                parts.push(childEl.textContent || "");
              }
            }
          }
          result.push(parts.join("") + "\n\n");
          return;
        }

        // Handle lists
        if (tag === "ul" || tag === "ol") {
          const items = elem.querySelectorAll(":scope > li");
          items.forEach((li, i) => {
            const prefix = tag === "ol" ? `${i + 1}. ` : "- ";
            result.push(prefix + li.textContent?.trim() + "\n");
          });
          result.push("\n");
          return;
        }

        // Handle horizontal rules
        if (tag === "hr") {
          result.push("\n---\n");
          return;
        }

        // Skip response-element wrappers, process children
        if (tag === "response-element") {
          // @ts-ignore works
          for (const child of elem.children) {
            processNode(child);
          }
          return;
        }

        // Default: recurse into children
        // @ts-ignore works
        for (const child of elem.childNodes) {
          processNode(child);
        }
      }

      // @ts-ignore works
      for (const child of container.childNodes) {
        processNode(child);
      }

      return result.join("").trim();
    });
  }

  async close() {
    console.log("[Gemini] Disconnecting adapter...");
    await closeBrowser(this.browser);
    this.browser = null;
    this.isReady = false;
  }
}
