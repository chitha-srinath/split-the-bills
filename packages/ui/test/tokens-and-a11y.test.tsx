import { describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { Button } from "../src/components/button";
import { Sheet, SheetContent, SheetTitle } from "../src/components/sheet";
import { Dialog, DialogContent, DialogTitle } from "../src/components/dialog";
import { Toaster, toast } from "../src/components/toast";

if (typeof window !== "undefined") {
  class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}

interface OklchColor {
  l: number;
  c: number;
  h: number;
}

function parseOklch(value: string): OklchColor {
  const match = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.%]+)?\s*\)/);
  if (!match) {
    throw new Error(`Failed to parse oklch color from: "${value}"`);
  }
  return {
    l: parseFloat(match[1]),
    c: parseFloat(match[2]),
    h: parseFloat(match[3]),
  };
}

function oklchToLinearSrgb(color: OklchColor): { r: number; g: number; b: number } {
  const { l: L, c: C, h: H } = color;
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b_rgb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return { r, g, b: b_rgb };
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function getContrast(colA: OklchColor, colB: OklchColor): number {
  const lumA = relativeLuminance(oklchToLinearSrgb(colA));
  const lumB = relativeLuminance(oklchToLinearSrgb(colB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

function extractCssBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, "m");
  const match = css.match(regex);
  if (!match) {
    throw new Error(`Selector "${selector}" not found in CSS`);
  }
  return match[1];
}

function parseCustomProperties(block: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = block.split(";");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("--")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const prop = trimmed.slice(0, colonIdx).trim();
    const val = trimmed.slice(colonIdx + 1).trim();
    map.set(prop, val);
  }
  return map;
}

describe("ST-003: Tokens & Accessibility", () => {
  const globalsCssPath = path.resolve(import.meta.dirname, "../src/styles/globals.css");
  const globalsCss = fs.readFileSync(globalsCssPath, "utf-8");

  describe("Case 1 — Cross-platform fonts & zero Windows-only declarations (AC-002)", () => {
    it("removes Windows-only fonts and hardcoded colors", () => {
      expect(globalsCss).not.toContain("Segoe UI Variable");
      expect(globalsCss).not.toContain("Aptos");
      expect(globalsCss).not.toContain("#d9ff6a");
    });

    it("defines cross-platform fonts in @theme inline", () => {
      const themeBlock = extractCssBlock(globalsCss, "@theme inline");
      expect(themeBlock).toContain("Plus Jakarta Sans");
      expect(themeBlock).toContain("system-ui");
      expect(themeBlock).toContain("Space Grotesk");
    });

    it("preserves apps/web @source and custom dark variant", () => {
      expect(globalsCss).toContain('@source "../../../../apps/web/src/**/*.{ts,tsx}";');
      expect(globalsCss).toContain("@custom-variant dark (&:is(.dark *));");
    });
  });

  describe("Case 2 — Unified Electric Bento tokens in :root & .dark (AC-003)", () => {
    const rootBlock = extractCssBlock(globalsCss, ":root");
    const darkBlock = extractCssBlock(globalsCss, ".dark");
    const rootProps = parseCustomProperties(rootBlock);
    const darkProps = parseCustomProperties(darkBlock);
    const themeBlock = extractCssBlock(globalsCss, "@theme inline");
    const themeProps = parseCustomProperties(themeBlock);

    const requiredTokens = [
      "--background",
      "--foreground",
      "--card",
      "--card-foreground",
      "--popover",
      "--popover-foreground",
      "--primary",
      "--primary-foreground",
      "--secondary",
      "--secondary-foreground",
      "--muted",
      "--muted-foreground",
      "--accent",
      "--accent-foreground",
      "--destructive",
      "--destructive-foreground",
      "--success",
      "--success-foreground",
      "--warning",
      "--warning-foreground",
      "--info",
      "--info-foreground",
      "--border",
      "--input",
      "--ring",
    ];

    it.each(requiredTokens)("defines %s in :root and .dark", (token) => {
      expect(rootProps.has(token), `:root missing ${token}`).toBe(true);
      expect(darkProps.has(token), `.dark missing ${token}`).toBe(true);
    });

    it("maps semantic tokens in @theme inline", () => {
      expect(themeProps.has("--color-success")).toBe(true);
      expect(themeProps.has("--color-success-foreground")).toBe(true);
      expect(themeProps.has("--color-warning")).toBe(true);
      expect(themeProps.has("--color-warning-foreground")).toBe(true);
      expect(themeProps.has("--color-info")).toBe(true);
      expect(themeProps.has("--color-info-foreground")).toBe(true);
      expect(themeProps.has("--color-destructive-foreground")).toBe(true);
    });
  });

  describe("Case 3 — WCAG AA contrast & sRGB gamut verification (AC-003)", () => {
    const rootBlock = extractCssBlock(globalsCss, ":root");
    const darkBlock = extractCssBlock(globalsCss, ".dark");
    const rootProps = parseCustomProperties(rootBlock);
    const darkProps = parseCustomProperties(darkBlock);

    it("verifies all oklch tokens fall strictly within sRGB gamut", () => {
      for (const [name, val] of [...rootProps.entries(), ...darkProps.entries()]) {
        if (!val.startsWith("oklch(")) continue;
        const oklch = parseOklch(val);
        const { r, g, b } = oklchToLinearSrgb(oklch);
        expect(r, `${name} red out of gamut`).toBeGreaterThanOrEqual(-0.01);
        expect(r, `${name} red out of gamut`).toBeLessThanOrEqual(1.01);
        expect(g, `${name} green out of gamut`).toBeGreaterThanOrEqual(-0.01);
        expect(g, `${name} green out of gamut`).toBeLessThanOrEqual(1.01);
        expect(b, `${name} blue out of gamut`).toBeGreaterThanOrEqual(-0.01);
        expect(b, `${name} blue out of gamut`).toBeLessThanOrEqual(1.01);
      }
    });

    const normalTextPairs = [
      ["--foreground", "--background"],
      ["--card-foreground", "--card"],
      ["--popover-foreground", "--popover"],
      ["--primary-foreground", "--primary"],
      ["--primary", "--background"],
      ["--primary", "--card"],
      ["--secondary-foreground", "--secondary"],
      ["--muted-foreground", "--background"],
      ["--muted-foreground", "--card"],
      ["--muted-foreground", "--muted"],
      ["--accent-foreground", "--accent"],
      ["--destructive", "--background"],
      ["--destructive", "--card"],
      ["--destructive-foreground", "--destructive"],
      ["--success", "--background"],
      ["--success-foreground", "--success"],
      ["--warning", "--background"],
      ["--warning-foreground", "--warning"],
      ["--info", "--background"],
      ["--info-foreground", "--info"],
    ] as const;

    const uiControlPairs = [
      ["--ring", "--background"],
      ["--ring", "--card"],
      ["--input", "--background"],
      ["--input", "--card"],
    ] as const;

    describe("normal text WCAG AA (>= 4.5:1) in :root", () => {
      it.each(normalTextPairs)("%s against %s", (fg, bg) => {
        const fgCol = parseOklch(rootProps.get(fg)!);
        const bgCol = parseOklch(rootProps.get(bg)!);
        const ratio = getContrast(fgCol, bgCol);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    });

    describe("normal text WCAG AA (>= 4.5:1) in .dark", () => {
      it.each(normalTextPairs)("%s against %s", (fg, bg) => {
        const fgCol = parseOklch(darkProps.get(fg)!);
        const bgCol = parseOklch(darkProps.get(bg)!);
        const ratio = getContrast(fgCol, bgCol);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    });

    describe("UI control contrast (>= 3.0:1) in :root", () => {
      it.each(uiControlPairs)("%s against %s", (fg, bg) => {
        const fgCol = parseOklch(rootProps.get(fg)!);
        const bgCol = parseOklch(rootProps.get(bg)!);
        const ratio = getContrast(fgCol, bgCol);
        expect(ratio).toBeGreaterThanOrEqual(3.0);
      });
    });

    describe("UI control contrast (>= 3.0:1) in .dark", () => {
      it.each(uiControlPairs)("%s against %s", (fg, bg) => {
        const fgCol = parseOklch(darkProps.get(fg)!);
        const bgCol = parseOklch(darkProps.get(bg)!);
        const ratio = getContrast(fgCol, bgCol);
        expect(ratio).toBeGreaterThanOrEqual(3.0);
      });
    });
  });

  describe("Case 4 — Button touch variants & preserved defaults (AC-004)", () => {
    it("retains default heights and includes touch variants", () => {
      render(
        <div>
          <Button data-testid="btn-default">Default</Button>
          <Button size="icon" aria-label="Default icon" data-testid="btn-icon" />
          <Button size="touch" data-testid="btn-touch">
            Continue
          </Button>
          <Button size="icon-touch" aria-label="Touch icon" data-testid="btn-icon-touch" />
        </div>,
      );

      const btnDefault = screen.getByTestId("btn-default");
      const btnIcon = screen.getByTestId("btn-icon");
      const btnTouch = screen.getByTestId("btn-touch");
      const btnIconTouch = screen.getByTestId("btn-icon-touch");

      expect(btnDefault.className).toContain("h-8");
      expect(btnIcon.className).toContain("size-8");
      expect(btnTouch.className).toContain("min-h-11");
      expect(btnTouch.className).toContain("h-11");
      expect(btnIconTouch.className).toContain("size-11");
      expect(btnIconTouch.className).toContain("min-h-11");
      expect(btnIconTouch.className).toContain("min-w-11");
    });
  });

  describe("Case 5 — Close-button hit expansion on SheetContent & DialogContent (AC-004)", () => {
    it("expands SheetContent close button hit target", () => {
      render(
        <Sheet open>
          <SheetContent>
            <SheetTitle>Details</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      const closeBtn = document.body.querySelector('[data-slot="sheet-close"]');
      expect(closeBtn).toBeInTheDocument();
      expect(closeBtn?.className).toContain("absolute");
      expect(closeBtn?.className).toContain("after:absolute");
      expect(closeBtn?.className).toContain("after:-inset-2");
      expect(closeBtn?.className).toContain("after:content-['']");
    });

    it("expands DialogContent close button hit target", () => {
      render(
        <Dialog open>
          <DialogContent>
            <DialogTitle>Confirm</DialogTitle>
          </DialogContent>
        </Dialog>,
      );

      const closeBtn = document.body.querySelector('[data-slot="dialog-close"]');
      expect(closeBtn).toBeInTheDocument();
      expect(closeBtn?.className).toContain("absolute");
      expect(closeBtn?.className).toContain("after:absolute");
      expect(closeBtn?.className).toContain("after:-inset-2");
      expect(closeBtn?.className).toContain("after:content-['']");
    });
  });

  describe("Case 6 — Mobile ToastViewport clearance & ToastClose hit target (AC-004, AC-011, AC-012)", () => {
    it("provides mobile bottom-20 clearance and expanded hit target", async () => {
      render(<Toaster />);

      act(() => {
        toast.add({ title: "Copied", type: "success" });
      });

      const viewport = document.body.querySelector('[data-slot="toast-viewport"]');
      expect(viewport).toBeInTheDocument();
      expect(viewport?.className).toContain("bottom-20");
      expect(viewport?.className).toContain("md:bottom-4");
      // Must not contain un-prefixed bottom-4
      const classes = viewport?.className.split(/\s+/) ?? [];
      expect(classes).not.toContain("bottom-4");

      const closeBtn = document.body.querySelector('[data-slot="toast-close"]');
      expect(closeBtn).toBeInTheDocument();
      expect(closeBtn?.className).toContain("after:-inset-2");
    });
  });
});
