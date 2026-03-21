// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isAISite, getAIContext } from "../content/ai-detect";

describe("ai-detect utilities", () => {
  describe("isAISite", () => {
    it("returns true for exact matches of AI domains", () => {
      expect(isAISite("https://chatgpt.com")).toBe(true);
      expect(isAISite("https://gemini.google.com")).toBe(true);
      expect(isAISite("https://claude.ai")).toBe(true);
      expect(isAISite("https://www.perplexity.ai")).toBe(true);
    });

    it("returns true for subdomains of AI domains", () => {
      expect(isAISite("https://sub.chatgpt.com")).toBe(true);
      expect(isAISite("https://another.gemini.google.com")).toBe(true);
      expect(isAISite("https://pro.claude.ai")).toBe(true);
    });

    it("returns false for non-AI domains", () => {
      expect(isAISite("https://google.com")).toBe(false);
      expect(isAISite("https://bing.com")).toBe(false);
      expect(isAISite("https://github.com")).toBe(false);
    });

    it("returns false for domains that end with AI domain names but are not subdomains", () => {
      expect(isAISite("https://notchatgpt.com")).toBe(false);
      expect(isAISite("https://mychatgpt.com")).toBe(false);
      expect(isAISite("https://theclaude.ai")).toBe(false);
    });

    it("returns false for invalid URLs", () => {
      expect(isAISite("not-a-url")).toBe(false);
      expect(isAISite("")).toBe(false);
    });
  });

  describe("getAIContext", () => {
    const originalLocation = typeof window !== 'undefined' ? window.location : null;
    const originalTitle = typeof document !== 'undefined' ? document.title : null;

    beforeEach(() => {
      // @ts-ignore - Mocking window.location
      delete window.location;
      window.location = { href: "" } as any;
    });

    afterEach(() => {
      window.location = originalLocation as any;
      document.title = originalTitle;
    });

    it("returns AI context for AI sites", () => {
      window.location.href = "https://chatgpt.com/c/123";
      document.title = "ChatGPT Conversation";

      const context = getAIContext();
      expect(context.isAI).toBe(true);
      expect(context.chatName).toBe("ChatGPT Conversation");
      expect(context.chatUrl).toBe("https://chatgpt.com/c/123");
    });

    it("returns empty context for non-AI sites", () => {
      window.location.href = "https://google.com/search?q=test";
      document.title = "Google Search";

      const context = getAIContext();
      expect(context.isAI).toBe(false);
      expect(context.chatName).toBe("");
      expect(context.chatUrl).toBe("");
    });
  });
});
