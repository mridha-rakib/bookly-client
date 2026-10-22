import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BooklyApiError } from "@/lib/api/client";
import { shouldRetryQuery } from "@/lib/query-client";
import PackagesListPage from "@/components/dashboard/packages/PackagesListPage";
import {
  businessId,
  categoryId,
  definition,
  serviceId,
  secondServiceId,
} from "./package-definitions-fixtures";
import type { PackageDefinition } from "@/lib/api/package-definitions";

const fx = vi.hoisted(() => ({
  request: vi.fn(),
  profile: { value: {} as Record<string, unknown> },
  search: "section=packages",
  push: vi.fn(),
  replace: vi.fn(),
  role: "BUSINESS_OWNER",
}));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: fx.request,
}));
vi.mock("@/lib/business/hooks", () => ({
  useMyBusinessProfileQuery: () => fx.profile.value,
  useManagedBusinessContext: () => ({ businessId: "111111111111111111111111" }),
  useBusinessQuery: () => ({
    data: { category: "Beauty", subcategories: ["Hair", "Facial"] },
    isPending: false,
    isError: false,
  }),
}));
vi.mock("@/lib/services/hooks", () => ({
  useServicesQuery: () => ({
    data: {
      services: [
        {
          id: "333333333333333333333333",
          name: "Hair",
          status: "ACTIVE",
          pricingMode: "FIXED",
          isPackageDeal: false,
        },
        {
          id: "444444444444444444444444",
          name: "Facial",
          status: "ACTIVE",
          pricingMode: "FIXED",
          isPackageDeal: false,
        },
        {
          id: "555555555555555555555555",
          name: "Old Package",
          status: "ACTIVE",
          isPackageDeal: true,
        },
        {
          id: "666666666666666666666666",
          name: "Hourly",
          status: "ACTIVE",
          pricingMode: "HOURLY",
          isPackageDeal: false,
        },
      ],
    },
    isPending: false,
    isError: false,
  }),
  useServiceCategoriesQuery: () => ({
    data: [{ id: "222222222222222222222222", name: "Treatments", active: true }],
    isPending: false,
    isError: false,
  }),
}));
vi.mock("@/components/dashboard/DashboardHeader", () => ({
  default: ({ title }: { title: string }) => createElement("h1", null, title),
}));
vi.mock("@/components/dashboard/services/ServicesListPage", () => ({
  default: () => createElement("p", null, "Existing Services section"),
}));
vi.mock("@/components/dashboard/DashboardCalendar", () => ({
  default: () => createElement("p", null, "Existing Calendar section"),
}));
vi.mock("@/components/ui/sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: fx.push, replace: fx.replace }),
  usePathname: () => "/business-dashboard",
  useSearchParams: () => new URLSearchParams(fx.search),
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/auth/store", () => ({
  useAuthStore: (select: (state: Record<string, unknown>) => unknown) =>
    select({
      status: "authenticated",
      user: { role: fx.role },
      isInitializing: false,
      logout: vi.fn(),
      isLoggingOut: false,
      restoreSession: vi.fn(),
    }),
}));
vi.mock("@/lib/auth/hooks", () => ({
  useCurrentUserQuery: () => ({
    data: {
      user: { email: "owner@example.com" },
      business: { name: "Beauty" },
    },
  }),
}));
vi.mock("@/lib/staff/hooks", () => ({
  useStaffListQuery: () => ({ data: { members: [] } }),
}));
vi.mock("@/lib/bookings/hooks", () => ({
  useBookingDetailQuery: () => ({}),
  useCompleteBookingMutation: () => ({}),
  useCancelByBusinessMutation: () => ({}),
  useRescheduleByOwnerMutation: () => ({}),
  useWaiveFeeMutation: () => ({}),
  useCancelNoShowMutation: () => ({}),
}));
vi.mock("@/components/dashboard/CalendarActionModals", () => ({
  CompleteModal: () => null,
  NoShowModal: () => null,
  CancelBookingModal: () => null,
}));
vi.mock("@/components/dashboard/WaiveChargeModal", () => ({
  default: () => null,
}));

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;
let current: PackageDefinition;
let listFailure: BooklyApiError | undefined;
let updateConflict: PackageDefinition | undefined;
const primary = { id: businessId, name: "Beauty", status: "APPROVED" };
const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });
};
const render = async (node: ReactNode = createElement(PackagesListPage)) => {
  await act(async () => root.render(createElement(QueryClientProvider, { client }, node)));
  await settle();
};
const button = (text: string) => {
  const mapped =
    (
      {
        "Make inactive": "Deactivate",
        "Make active": "Activate",
        "Restore as inactive": "Restore inactive",
        "Restore as active": "Restore active",
      } as Record<string, string>
    )[text] ?? text;
  const found = [...container.querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === mapped || node.getAttribute("aria-label") === mapped,
  );
  if (!found) throw new Error(`Missing button ${text}: ${container.textContent}`);
  return found;
};
const click = async (text: string) => {
  const target = button(text);
  const disclosure = target.closest("details");
  if (disclosure && !disclosure.open)
    await act(async () => disclosure.querySelector("summary")!.click());
  await act(async () => target.click());
  await settle();
};
const control = (text: string, index = 0) => {
  const labels = [...container.querySelectorAll("label")].filter((node) =>
    node.textContent?.startsWith(text),
  );
  const found = labels[index]?.querySelector("input,select,textarea");
  if (!found) throw new Error(`Missing field ${text}`);
  return found as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
};
const change = async (label: string, value: string, index = 0) => {
  const element = control(label, index);
  const prototype =
    element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
};
const submit = async () => {
  await act(async () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  await settle();
};
const writes = () =>
  fx.request.mock.calls
    .map(([config]) => config as AxiosRequestConfig)
    .filter((config) => config.method !== "GET");
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  current = definition();
  listFailure = undefined;
  updateConflict = undefined;
  fx.role = "BUSINESS_OWNER";
  fx.search = "section=packages";
  fx.push.mockReset();
  fx.replace.mockReset();
  fx.profile.value = {
    data: { primary, secondary: [] },
    isPending: false,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  };
  fx.request.mockReset();
  fx.request.mockImplementation(async (config: AxiosRequestConfig) => {
    const url = config.url!;
    if (!url.startsWith(`/businesses/${businessId}/packages`))
      throw new Error(`Unexpected API ${url}`);
    if (config.method === "GET" && url.endsWith("/packages")) {
      if (listFailure) throw listFailure;
      return {
        packages: config.params?.archived
          ? current.status === "ARCHIVED"
            ? [current]
            : []
          : current.status !== "ARCHIVED"
            ? [current]
            : [],
      };
    }
    if (config.method === "GET") return current;
    if (config.method === "DELETE") {
      current = {
        ...current,
        status: "ARCHIVED",
        revision: current.revision + 1,
      };
      return undefined;
    }
    if (url.endsWith("/status") || url.endsWith("/restore")) {
      current = {
        ...current,
        status: config.data.status,
        revision: current.revision + 1,
      };
      return current;
    }
    if (config.method === "PATCH" && updateConflict) {
      current = updateConflict;
      updateConflict = undefined;
      throw new BooklyApiError({
        code: "PACKAGE_REVISION_CONFLICT",
        status: 409,
        message: "Revision conflict",
      });
    }
    current = {
      ...current,
      ...config.data,
      contractTerms: config.data.contractTerms?.validity
        ? { version: 2, ...config.data.contractTerms, penaltyPolicyVersion: 1 }
        : config.data.contractTerms
          ? {
              version: 1,
              ...config.data.contractTerms,
              penaltyPolicyVersion: 1,
            }
          : undefined,
      revision: current.revision + 1,
    };
    return current;
  });
  client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        retryDelay: 0,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

describe("Owner Package management with mocked dedicated APIs", () => {
  it("prioritizes price, validity and human status with compact identity-labelled actions", async () => {
    await render();
    const card = container.querySelector("article")!;
    expect(card.textContent).toContain("€199.99");
    expect(card.textContent).toContain("Forever");
    expect(card.textContent).toContain("Active");
    expect(card.textContent).not.toContain("Revision");
    expect(card.textContent).not.toContain("Catalog sellable");
    const view = card.querySelector('button[aria-label="View Hair & Facial"]')!;
    expect(view.textContent).toBe("View");
    expect(card.querySelector('summary[aria-label="Actions for Hair & Facial"]')).not.toBeNull();
    expect(container.textContent?.match(/Customer Package checkout/g)).toHaveLength(1);
  });
  it("closes the disclosure on Escape and restores focus without fetching", async () => {
    await render();
    const details = container.querySelector("article details")! as HTMLDetailsElement;
    const summary = details.querySelector("summary")!;
    await act(async () => summary.click());
    expect(details.open).toBe(true);
    const view = details.querySelector("button")!;
    await act(async () => {
      view.focus();
      view.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
    expect(fx.request).toHaveBeenCalledTimes(1);
  });
  it("groups complete edit fields into dashboard form sections without hiding setup errors", async () => {
    current = definition({ dependencyIssues: [{ code: "PACKAGE_PROVIDER_REQUIRED" }] });
    await render();
    expect(container.textContent).toContain("needs an active assigned provider");
    await click("Edit Hair & Facial");
    expect([...container.querySelectorAll("form h3")].map((node) => node.textContent)).toEqual([
      "Basic Package Information",
      "Included Services",
      "Pricing",
      "Validity",
      "Cancellation / No-show Protection",
      "Publication / Status",
    ]);
    expect(container.querySelectorAll('form input[inputmode="numeric"]')).toHaveLength(2);
    expect(container.querySelector("details summary")?.textContent).toContain(
      "Definition setup details",
    );
  });
  it("lists real definitions once without polling or purchased-progress calls", async () => {
    await render();
    expect(container.textContent).toContain("Hair & Facial");
    expect(container.textContent).not.toContain("Catalog sellable");
    expect(container.textContent).toContain("Forever");
    await settle();
    await settle();
    expect(fx.request).toHaveBeenCalledTimes(1);
    expect(writes()).toHaveLength(0);
  });
  it("loads complete detail for view/edit and preserves full replacement fields", async () => {
    const original = current;
    await render();
    await click("View Hair & Facial");
    expect((control("Package name") as HTMLInputElement).value).toBe(original.name);
    expect(control("Package name").matches(":disabled")).toBe(true);
    await click("Back to Packages");
    await click("Edit Hair & Facial");
    await change("Package name", "Renamed safely");
    await submit();
    const write = writes()[0];
    expect(write.method).toBe("PATCH");
    expect(write.data).toMatchObject({
      name: "Renamed safely",
      expectedRevision: 3,
      items: original.items,
      contractTerms: { validity: { mode: "FOREVER" } },
      isFeatured: true,
      description: original.description,
    });
    expect(write.data.contractTerms).not.toHaveProperty("version");
  });
  it.each(["6", "12", "FOREVER"])(
    "creates a multi-Service Package with %s validity, exact cents and P0",
    async (validity) => {
      await render();
      await click("Create Package");
      expect((control("Package validity") as HTMLSelectElement).value).toBe("UNCONFIGURED");
      await change("Package name", "New catalog");
      await change("Service category", categoryId);
      await change("Business subcategory", "Hair");
      await change("Selling price", "19.99");
      await change("Package validity", validity);
      await change("Add a FIXED Service", serviceId);
      await click("Add Service");
      await change("Included sessions", "3");
      await change("Reference unit price", "20");
      await change("Penalty basis", "0");
      await change("Add a FIXED Service", secondServiceId);
      await click("Add Service");
      await change("Included sessions", "2", 1);
      await change("Reference unit price", "30", 1);
      await change("Penalty basis", "50", 1);
      await change("Definition status", "ACTIVE");
      await submit();
      const write = writes()[0];
      expect(write.method).toBe("POST");
      expect(write.data.bundlePriceCents).toBe(1999);
      expect(write.data.items).toEqual([
        {
          serviceId,
          includedSessions: 3,
          referenceUnitPriceCents: 2000,
          penaltyBasisCents: 0,
        },
        {
          serviceId: secondServiceId,
          includedSessions: 2,
          referenceUnitPriceCents: 3000,
          penaltyBasisCents: 5000,
        },
      ]);
      expect(write.data.contractTerms).toEqual({
        validity:
          validity === "FOREVER"
            ? { mode: "FOREVER" }
            : { mode: "FINITE", months: Number(validity) },
      });
    },
  );
  it("preserves missing validity and missing basis on an unrelated legacy Definition edit", async () => {
    current = definition({
      contractTerms: undefined,
      status: "DRAFT",
      items: [{ itemId: "bbbbbbbbbbbbbbbbbbbbbbbb", serviceId, includedSessions: 1 }],
    });
    await render();
    await click("Edit Hair & Facial");
    expect((control("Package validity") as HTMLSelectElement).value).toBe("UNCONFIGURED");
    await change("Package name", "Still unconfigured");
    await submit();
    expect(writes()[0].data.contractTerms).toBeUndefined();
    expect(writes()[0].data.items[0].penaltyBasisCents).toBeUndefined();
  });
  it("preserves unsaved changes on 409 and requires explicit latest-revision review", async () => {
    updateConflict = definition({ name: "Other Owner edit", revision: 4 });
    await render();
    await click("Edit Hair & Facial");
    await change("Package name", "My unsaved edit");
    await submit();
    expect((control("Package name") as HTMLInputElement).value).toBe("My unsaved edit");
    expect(container.textContent).toContain("Other Owner edit");
    expect(button("Save Package").disabled).toBe(true);
    expect(writes()).toHaveLength(1);
    await click("I reviewed the latest version — keep my edits");
    await submit();
    expect(writes()[1].data).toMatchObject({
      expectedRevision: 4,
      name: "My unsaved edit",
    });
  });
  it("retains the editor when the conflict refresh fails and retries only on Owner action", async () => {
    await render();
    await click("Edit Hair & Facial");
    await change("Package name", "Keep this draft");
    fx.request
      .mockRejectedValueOnce(
        new BooklyApiError({
          status: 409,
          code: "PACKAGE_REVISION_CONFLICT",
          message: "Changed",
        }),
      )
      .mockRejectedValueOnce(new BooklyApiError({ status: 403, message: "Refresh unavailable" }));
    await submit();
    expect((control("Package name") as HTMLInputElement).value).toBe("Keep this draft");
    expect(button("Save Package").disabled).toBe(true);
    expect(container.textContent).toContain("Refresh unavailable");
    await click("Refresh latest definition");
    expect((control("Package name") as HTMLInputElement).value).toBe("Keep this draft");
    expect(writes()).toHaveLength(1);
  });
  it("prevents local invalid money and presents server dependency validation without repeated writes", async () => {
    await render();
    await click("Edit Hair & Facial");
    await change("Penalty basis", "50.01");
    await submit();
    expect(writes()).toHaveLength(0);
    expect(container.textContent).toContain("Please check the Package fields");
    await change("Penalty basis", "50.00");
    fx.request.mockRejectedValueOnce(
      new BooklyApiError({
        status: 400,
        code: "PACKAGE_COMPOSITION_INVALID",
        message: "Invalid Package dependency",
        errors: [
          {
            code: "PACKAGE_PROVIDER_REQUIRED",
            message: "Invalid dependency",
            path: "items.test",
          },
        ],
      }),
    );
    await submit();
    expect(container.textContent).toContain("needs an active assigned provider");
    await settle();
    expect(writes()).toHaveLength(1);
  });
  it("does not allow editing a foreign detail returned by a faulty API", async () => {
    await render();
    current = definition({ businessId: "ffffffffffffffffffffffff" });
    await click("Edit Hair & Facial");
    expect(container.textContent).toContain("belongs to another Business");
    expect(container.querySelector("form")).toBeNull();
  });
  it("supports deliberate discard after conflict without a write loop", async () => {
    updateConflict = definition({ revision: 5, name: "Saved by someone else" });
    await render();
    await click("Edit Hair & Facial");
    await change("Package name", "Unsaved");
    await submit();
    await click("Discard my edits and load latest");
    expect((control("Package name") as HTMLInputElement).value).toBe("Saved by someone else");
    expect(writes()).toHaveLength(1);
  });
  it("changes status with the current revision, confirms archive, filters and restores", async () => {
    const originalItems = current.items;
    const originalTerms = current.contractTerms;
    await render();
    await click("Make inactive");
    expect(writes()[0].data).toEqual({
      status: "INACTIVE",
      expectedRevision: 3,
    });
    await click("Archive Hair & Facial");
    expect(writes()).toHaveLength(1);
    await click("Keep Package");
    expect(writes()).toHaveLength(1);
    await click("Archive Hair & Facial");
    await click("Confirm archive");
    expect(writes()[1].params).toEqual({ expectedRevision: 4 });
    await change("Show Packages", "ARCHIVED");
    await settle();
    expect(container.textContent).toContain("Hair & Facial");
    await click("Restore as inactive");
    expect(writes()[2].data).toEqual({
      status: "INACTIVE",
      expectedRevision: 5,
    });
    expect(current.items).toEqual(originalItems);
    expect(current.contractTerms).toEqual(originalTerms);
  });
  it("holds status actions after a revision conflict until the refreshed list is reviewed", async () => {
    await render();
    fx.request.mockRejectedValueOnce(
      new BooklyApiError({
        code: "PACKAGE_REVISION_CONFLICT",
        status: 409,
        message: "Changed",
      }),
    );
    await click("Make inactive");
    expect(button("Make inactive").disabled).toBe(true);
    await click("I reviewed the refreshed list");
    expect(button("Make inactive").disabled).toBe(false);
  });
  it.each([400, 401, 403, 404, 429, 500])(
    "displays HTTP %i errors and supports manual retry without storms",
    async (status) => {
      listFailure = new BooklyApiError({
        status,
        message: `Fixture ${status}`,
      });
      await render();
      await settle();
      expect(container.textContent).toContain(`Fixture ${status}`);
      expect(fx.request.mock.calls.length).toBe(status === 500 ? 2 : 1);
      listFailure = undefined;
      await click("Try again");
      expect(container.textContent).toContain("Hair & Facial");
    },
  );
  it("shows loading and empty states", async () => {
    let resolve: (value: unknown) => void = () => {};
    fx.request.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await render();
    expect(container.textContent).toContain("Loading Packages");
    await act(async () => resolve({ packages: [] }));
    await settle();
    expect(container.textContent).toContain("No Packages match");
  });
  it.each([undefined, { ...primary, status: "PENDING" }, { ...primary, status: "SUSPENDED" }])(
    "does not dispatch definitions without approved owned Business context %j",
    async (business) => {
      fx.profile.value = { ...fx.profile.value, data: { primary: business } };
      await render();
      expect(fx.request).not.toHaveBeenCalled();
      expect(container.textContent).toContain("owned by your account");
    },
  );
  it("excludes legacy Package Deals and hourly Services from item choices", async () => {
    await render();
    await click("Create Package");
    const select = control("Add a FIXED Service");
    expect(select.textContent).toContain("Hair");
    expect(select.textContent).not.toContain("Old Package");
    expect(select.textContent).not.toContain("Hourly");
    expect(container.querySelector('a[href*="purchase"]')).toBeNull();
  });
});

describe("existing Owner Dashboard Packages navigation", () => {
  it("renders Packages for a direct link and preserves sidebar slug navigation and normalization", async () => {
    const Dashboard = (await import("@/app/business-dashboard/page")).default;
    await render(createElement(Dashboard));
    expect(container.textContent).toContain("Create Package");
    await click("Packages");
    expect(fx.replace).not.toHaveBeenCalled();
    fx.search = "section=services";
    await render(createElement(Dashboard));
    await click("Packages");
    expect(fx.push).toHaveBeenLastCalledWith("/business-dashboard?section=packages");
    fx.search = "section=packages";
    await render(createElement(Dashboard));
    expect(container.textContent).toContain("Create Package");
    fx.search = "section=unknown";
    await render(createElement(Dashboard));
    expect(fx.replace).toHaveBeenCalled();
  });
  it.each(["STAFF", "SUPERVISOR"])("keeps %s outside the real Owner guard", async (role) => {
    const Dashboard = (await import("@/app/business-dashboard/page")).default;
    fx.role = role;
    await render(createElement(Dashboard));
    expect(container.textContent).not.toContain("Create Package");
    expect(fx.request).not.toHaveBeenCalled();
  });
});
