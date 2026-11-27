import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AdaptiveSheet,
  AdaptiveSheetTrigger,
  AdaptiveSheetClose,
  AdaptiveSheetContent,
  AdaptiveSheetHeader,
  AdaptiveSheetBody,
  AdaptiveSheetFooter,
  AdaptiveSheetTitle,
  AdaptiveSheetDescription,
} from "../src/components/adaptive-sheet";

if (typeof window !== "undefined") {
  class MockResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}

describe("AdaptiveSheet", () => {
  let mediaListeners: Array<() => void> = [];

  function setViewport(width: number) {
    window.innerWidth = width;
    const matches = width < 768;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, cb: () => void) => {
          if (event === "change") {
            mediaListeners.push(cb);
          }
        }),
        removeEventListener: vi.fn((event: string, cb: () => void) => {
          if (event === "change") {
            mediaListeners = mediaListeners.filter((l) => l !== cb);
          }
        }),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  beforeEach(() => {
    mediaListeners = [];
  });

  describe("Case 1 — Mobile viewport (< 768px) renders Drawer with swipe handle (AC-011, AC-012)", () => {
    it("renders drawer popup and handle on mobile", () => {
      setViewport(375);

      render(
        <AdaptiveSheet open>
          <AdaptiveSheetContent>
            <AdaptiveSheetHeader>
              <AdaptiveSheetTitle>Split details</AdaptiveSheetTitle>
              <AdaptiveSheetDescription>Review shares</AdaptiveSheetDescription>
            </AdaptiveSheetHeader>
            <AdaptiveSheetBody>Body content</AdaptiveSheetBody>
            <AdaptiveSheetFooter>
              <AdaptiveSheetClose>Close</AdaptiveSheetClose>
            </AdaptiveSheetFooter>
          </AdaptiveSheetContent>
        </AdaptiveSheet>,
      );

      expect(document.body.querySelector('[data-slot="drawer-popup"]')).toBeInTheDocument();
      expect(document.body.querySelector('[data-slot="drawer-swipe-handle"]')).toBeInTheDocument();
      expect(document.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
      expect(screen.getByText("Split details")).toBeInTheDocument();
      expect(screen.getByText("Review shares")).toBeInTheDocument();
      expect(screen.getByText("Body content")).toBeInTheDocument();
    });
  });

  describe("Case 2 — Desktop viewport (>= 768px) renders Sheet with side='right' (AC-011, AC-012)", () => {
    it("renders sheet content on desktop", () => {
      setViewport(1280);

      render(
        <AdaptiveSheet open>
          <AdaptiveSheetContent side="right">
            <AdaptiveSheetHeader>
              <AdaptiveSheetTitle>Split details</AdaptiveSheetTitle>
              <AdaptiveSheetDescription>Review shares</AdaptiveSheetDescription>
            </AdaptiveSheetHeader>
            <AdaptiveSheetBody>Body content</AdaptiveSheetBody>
            <AdaptiveSheetFooter>
              <AdaptiveSheetClose>Close</AdaptiveSheetClose>
            </AdaptiveSheetFooter>
          </AdaptiveSheetContent>
        </AdaptiveSheet>,
      );

      const sheetContent = document.body.querySelector('[data-slot="sheet-content"]');
      expect(sheetContent).toBeInTheDocument();
      expect(sheetContent?.getAttribute("data-side")).toBe("right");
      expect(document.body.querySelector('[data-slot="sheet-close"]')).toBeInTheDocument();
      expect(document.body.querySelector('[data-slot="drawer-popup"]')).not.toBeInTheDocument();
    });
  });

  describe("Case 3 — Responsive viewport switch & onOpenChange callback (AC-011, AC-012)", () => {
    it("switches from sheet to drawer on viewport resize", () => {
      setViewport(1280);

      render(
        <AdaptiveSheet open>
          <AdaptiveSheetContent>
            <AdaptiveSheetHeader>
              <AdaptiveSheetTitle>Responsive title</AdaptiveSheetTitle>
            </AdaptiveSheetHeader>
            <AdaptiveSheetBody>Responsive body</AdaptiveSheetBody>
          </AdaptiveSheetContent>
        </AdaptiveSheet>,
      );

      expect(document.body.querySelector('[data-slot="sheet-content"]')).toBeInTheDocument();
      expect(document.body.querySelector('[data-slot="drawer-popup"]')).not.toBeInTheDocument();

      // Trigger resize to mobile
      act(() => {
        window.innerWidth = 375;
        for (const listener of mediaListeners) {
          listener();
        }
      });

      expect(document.body.querySelector('[data-slot="drawer-popup"]')).toBeInTheDocument();
      expect(document.body.querySelector('[data-slot="sheet-content"]')).not.toBeInTheDocument();
    });

    it("triggers onOpenChange when trigger is clicked", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      setViewport(1280);

      render(
        <AdaptiveSheet onOpenChange={onOpenChange}>
          <AdaptiveSheetTrigger>Open Sheet</AdaptiveSheetTrigger>
          <AdaptiveSheetContent>
            <AdaptiveSheetTitle>Opened title</AdaptiveSheetTitle>
          </AdaptiveSheetContent>
        </AdaptiveSheet>,
      );

      const trigger = screen.getByText("Open Sheet");
      await user.click(trigger);

      expect(onOpenChange).toHaveBeenCalledWith(true);
    });
  });
});
