import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock container for Google Maps pane
let overlayMouseTargetPane: HTMLDivElement;

interface OverlayLifecycle {
  onAdd?: () => void;
  draw?: () => void;
  onRemove?: () => void;
}

class MockOverlayView {
  setMap = vi.fn((map: unknown) => {
    const self = this as unknown as OverlayLifecycle;
    if (map) {
      self.onAdd?.();
      self.draw?.();
    } else {
      self.onRemove?.();
    }
  });

  getPanes() {
    return {
      overlayMouseTarget: overlayMouseTargetPane,
      overlayLayer: overlayMouseTargetPane,
      floatPane: overlayMouseTargetPane,
      mapPane: overlayMouseTargetPane,
      markerLayer: overlayMouseTargetPane,
    };
  }

  getProjection() {
    return {
      fromLatLngToDivPixel: () => ({ x: 150, y: 250 }),
      fromDivPixelToLatLng: vi.fn(),
    };
  }
}

class MockMap {
  constructor(public container: HTMLElement, public options?: Record<string, unknown>) {}
  setCenter = vi.fn();
}

class MockLatLng {
  public lat: number;
  public lng: number;

  constructor(latOrLiteral: number | { lat: number; lng: number }, lng?: number) {
    if (typeof latOrLiteral === "object" && latOrLiteral !== null) {
      this.lat = latOrLiteral.lat;
      this.lng = latOrLiteral.lng;
    } else {
      this.lat = latOrLiteral;
      this.lng = lng ?? 0;
    }
  }
}

vi.mock("@/lib/maps/googleMapsLoader", () => ({
  isGoogleMapsConfigured: vi.fn(() => true),
  loadGoogleMapsLibrary: vi.fn(async (lib: string) => {
    if (lib === "maps") {
      return {
        OverlayView: MockOverlayView,
        Map: MockMap,
        LatLng: MockLatLng,
      };
    }
    return {};
  }),
}));

import VenueLocationMap from "@/app/venue/components/VenueLocationMap";

describe("VenueLocationMap - Canonical Business Profile Marker Parity", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    (globalThis as unknown as { google?: unknown }).google = {
      maps: {
        Map: MockMap,
        LatLng: MockLatLng,
        OverlayView: MockOverlayView,
      },
    };
    overlayMouseTargetPane = document.createElement("div");
    document.body.appendChild(overlayMouseTargetPane);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    overlayMouseTargetPane.remove();
    vi.clearAllMocks();
  });

  it("renders the canonical 48px circular marker with black border, pointer tail, and drop-shadow", async () => {
    await act(async () => {
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(VenueLocationMap, {
            lat: 34.9172,
            lng: 33.6232,
            businessName: "Aurelia Hair & Beauty Studio",
            displayAddress: "Larnaca, Larnaca",
            profileImageUrl: "https://example.com/salon.jpg",
          })
        )
      );
    });

    // Verify root wrapper was added to overlayMouseTarget
    const wrapper = overlayMouseTargetPane.firstElementChild as HTMLDivElement;
    expect(wrapper).not.toBeNull();
    expect(wrapper.style.position).toBe("absolute");
    expect(wrapper.style.transform).toBe("translate(-50%,-100%)");

    // Verify liftGroup
    const liftGroup = wrapper.children[0] as HTMLDivElement;
    expect(liftGroup).not.toBeNull();
    expect(liftGroup.style.display).toBe("flex");
    expect(liftGroup.style.flexDirection).toBe("column");
    expect(liftGroup.style.filter).toContain("drop-shadow(0 3px 6px rgba(0,0,0,0.28))");
    expect(liftGroup.style.transformOrigin).toBe("50% 100%");

    // Verify 48px circle
    const circle = liftGroup.children[0] as HTMLDivElement;
    expect(circle.style.width).toBe("48px");
    expect(circle.style.height).toBe("48px");
    expect(circle.style.borderRadius).toBe("50%");
    expect(circle.style.overflow).toBe("hidden");
    expect(circle.style.border).toBe("3px solid rgb(0, 0, 0)");

    // Verify profile image inside circle
    const img = circle.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.src).toBe("https://example.com/salon.jpg");
    expect(img?.style.objectFit).toBe("cover");

    // Verify 16x11px pointer tail with 3px overlap
    const pointer = liftGroup.children[1] as HTMLDivElement;
    expect(pointer.style.width).toBe("0px");
    expect(pointer.style.height).toBe("0px");
    expect(pointer.style.marginTop).toBe("-3px");
    expect(pointer.style.borderLeft).toBe("8px solid transparent");
    expect(pointer.style.borderRight).toBe("8px solid transparent");
    expect(pointer.style.borderTop).toBe("11px solid rgb(0, 0, 0)");

    // Verify hover card tooltip
    const card = wrapper.children[1] as HTMLDivElement;
    expect(card).not.toBeNull();
    expect(card.style.background).toBe("rgb(17, 17, 17)");
    expect(card.style.color).toBe("rgb(255, 255, 255)");
    expect(card.style.borderRadius).toBe("8px");
    expect(card.style.pointerEvents).toBe("none");

    // Card contains name and address
    expect(card.textContent).toContain("Aurelia Hair & Beauty Studio");
    expect(card.textContent).toContain("Larnaca, Larnaca");

    // Test hover interactions: mouseenter -> scale(1.06) & visible
    act(() => {
      wrapper.dispatchEvent(new MouseEvent("mouseenter"));
    });
    expect(liftGroup.style.transform).toBe("scale(1.06)");
    expect(card.style.opacity).toBe("1");
    expect(card.style.visibility).toBe("visible");

    // mouseleave -> scale(1) & hidden
    act(() => {
      wrapper.dispatchEvent(new MouseEvent("mouseleave"));
    });
    expect(liftGroup.style.transform).toBe("scale(1)");
    expect(card.style.opacity).toBe("0");
    expect(card.style.visibility).toBe("hidden");
  });

  it("renders fallback SVG icon when no profile image exists", async () => {
    await act(async () => {
      root.render(
        createElement(VenueLocationMap, {
          lat: 34.9172,
          lng: 33.6232,
          businessName: "No Image Salon",
          displayAddress: "Nicosia",
          profileImageUrl: undefined,
        })
      );
    });

    const wrapper = overlayMouseTargetPane.firstElementChild as HTMLDivElement;
    const circle = wrapper.querySelector("div[style*='border-radius: 50%']") as HTMLDivElement;
    expect(circle).not.toBeNull();

    // No img element, instead the SVG fallback icon is rendered
    expect(circle.querySelector("img")).toBeNull();
    const svg = circle.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg?.getAttribute("stroke")).toBe("#A3A3A3");
  });

  it("falls back to SVG camera icon when image fails to load (onerror)", async () => {
    await act(async () => {
      root.render(
        createElement(VenueLocationMap, {
          lat: 34.9172,
          lng: 33.6232,
          businessName: "Broken Image Salon",
          profileImageUrl: "https://example.com/broken.jpg",
        })
      );
    });

    const wrapper = overlayMouseTargetPane.firstElementChild as HTMLDivElement;
    const circle = wrapper.querySelector("div[style*='border-radius: 50%']") as HTMLDivElement;
    const img = circle.querySelector("img");
    expect(img).not.toBeNull();

    // Trigger image error
    act(() => {
      img?.onerror?.(new Event("error"));
    });

    // Image is replaced with fallback SVG
    expect(circle.querySelector("img")).toBeNull();
    const svg = circle.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
  });

  it("renders loading spinner when profileMedia is loading", async () => {
    await act(async () => {
      root.render(
        createElement(VenueLocationMap, {
          lat: 34.9172,
          lng: 33.6232,
          businessName: "Loading Salon",
          profileMedia: { status: "loading" },
        })
      );
    });

    const wrapper = overlayMouseTargetPane.firstElementChild as HTMLDivElement;
    const circle = wrapper.querySelector("div[style*='border-radius: 50%']") as HTMLDivElement;
    const svg = circle.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 0 20 20");
    expect(svg?.querySelector("animateTransform")).not.toBeNull();
  });
});
