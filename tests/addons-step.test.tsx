import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddonsStep from "@/app/venue/components/AddonsStep";
import type { CatalogAddon } from "@/lib/api/catalog";

const sampleAddons: CatalogAddon[] = [
  {
    id: "addon-1",
    name: "Deep Conditioning Hair Treatment",
    description:
      "Intensive conditioning treatment that hydrates dry or damaged hair, improves softness and shine, and adds approximately 15 minutes to the service.",
    priceCents: 1200,
  },
  {
    id: "addon-2",
    name: "QA MATRIX — Add-on Multi Service",
    description:
      "QA representative test add-on assigned to multiple services including a package.",
    priceCents: 2500,
  },
  {
    id: "addon-3",
    name: "Express Scalp Massage",
    description: "Quick 5-min scalp soothing.",
    priceCents: 500,
  },
];

describe("AddonsStep - Checkmark circular layout & flex-shrink protection", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const renderComponent = async (
    addons: CatalogAddon[],
    selectedAddonIds: string[],
    setSelectedAddonIds = vi.fn()
  ) => {
    await act(async () => {
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(AddonsStep, {
            addons,
            isLoading: false,
            selectedAddonIds,
            setSelectedAddonIds,
          })
        )
      );
    });
  };

  it("renders both short and long description cards with protected flex-shrink and aspect ratio classes", async () => {
    await renderComponent(sampleAddons, ["addon-1", "addon-2"]);

    // Find all addon cards
    const cards = container.querySelectorAll(".rounded-lg.p-6");
    expect(cards.length).toBe(3);

    // Each card must have gap-4 to guarantee breathing room between content and action button
    cards.forEach((card) => {
      expect(card.classList.contains("gap-4")).toBe(true);
      expect(card.classList.contains("flex")).toBe(true);
      expect(card.classList.contains("justify-between")).toBe(true);
      expect(card.classList.contains("items-center")).toBe(true);
    });

    // Content container must have min-w-0 and flex-1 to allow text wrapping without expanding flex parent
    const textContainers = container.querySelectorAll(".flex-col.gap-2");
    expect(textContainers.length).toBe(3);
    textContainers.forEach((tc) => {
      expect(tc.classList.contains("min-w-0")).toBe(true);
      expect(tc.classList.contains("flex-1")).toBe(true);
    });

    // Check button classes for selected items
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(3);

    // Button 1 (Deep Conditioning - long description, selected)
    const btn1 = buttons[0];
    expect(btn1.classList.contains("shrink-0")).toBe(true);
    expect(btn1.classList.contains("w-8")).toBe(true);
    expect(btn1.classList.contains("h-8")).toBe(true);
    expect(btn1.classList.contains("min-w-8")).toBe(true);
    expect(btn1.classList.contains("min-h-8")).toBe(true);
    expect(btn1.classList.contains("aspect-square")).toBe(true);
    expect(btn1.classList.contains("rounded-full")).toBe(true);
    expect(btn1.getAttribute("aria-label")).toBe("Remove Deep Conditioning Hair Treatment");

    // Button 1 should contain an SVG checkmark with shrink-0
    const svg1 = btn1.querySelector("svg");
    expect(svg1).not.toBeNull();
    expect(svg1?.classList.contains("w-4")).toBe(true);
    expect(svg1?.classList.contains("h-4")).toBe(true);
    expect(svg1?.classList.contains("shrink-0")).toBe(true);

    // Button 2 (QA MATRIX - selected)
    const btn2 = buttons[1];
    expect(btn2.classList.contains("shrink-0")).toBe(true);
    expect(btn2.classList.contains("w-8")).toBe(true);
    expect(btn2.classList.contains("h-8")).toBe(true);
    expect(btn2.classList.contains("min-w-8")).toBe(true);
    expect(btn2.classList.contains("min-h-8")).toBe(true);
    expect(btn2.classList.contains("aspect-square")).toBe(true);
    expect(btn2.getAttribute("aria-label")).toBe("Remove QA MATRIX — Add-on Multi Service");

    // Button 3 (Unselected - Add state)
    const btn3 = buttons[2];
    expect(btn3.classList.contains("shrink-0")).toBe(true);
    expect(btn3.textContent).toBe("Add");
    expect(btn3.getAttribute("aria-label")).toBe("Add Express Scalp Massage");
  });

  it("handles selection and deselection toggle callbacks", async () => {
    const setSelectedAddonIds = vi.fn();
    await renderComponent(sampleAddons, ["addon-1"], setSelectedAddonIds);

    const buttons = container.querySelectorAll("button");

    // Click on selected button (addon-1) -> deselect
    act(() => {
      buttons[0].click();
    });
    expect(setSelectedAddonIds).toHaveBeenCalledTimes(1);
    const updater1 = setSelectedAddonIds.mock.calls[0][0];
    expect(typeof updater1).toBe("function");
    expect(updater1(["addon-1"])).toEqual([]);

    // Click on unselected button (addon-2) -> select
    act(() => {
      buttons[1].click();
    });
    expect(setSelectedAddonIds).toHaveBeenCalledTimes(2);
    const updater2 = setSelectedAddonIds.mock.calls[1][0];
    expect(updater2(["addon-1"])).toEqual(["addon-1", "addon-2"]);
  });

  it("renders correctly with empty add-ons or loading state", async () => {
    await act(async () => {
      root.render(
        createElement(AddonsStep, {
          addons: [],
          isLoading: true,
          selectedAddonIds: [],
          setSelectedAddonIds: vi.fn(),
        })
      );
    });
    expect(container.textContent).toContain("Loading add-ons…");

    await act(async () => {
      root.render(
        createElement(AddonsStep, {
          addons: [],
          isLoading: false,
          selectedAddonIds: [],
          setSelectedAddonIds: vi.fn(),
        })
      );
    });
    expect(container.textContent).toContain("No add-ons are available for this service.");
  });
});
