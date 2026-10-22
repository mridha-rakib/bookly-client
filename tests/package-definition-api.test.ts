import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api/client";
import { packageDefinitionsApi } from "@/lib/api/package-definitions";
import { definitionToForm, formToDefinition } from "@/lib/package-definitions/schema";
import { definitionKeys } from "@/lib/package-definitions/hooks";
import { businessId, definition } from "./package-definitions-fixtures";
vi.mock("@/lib/api/client", () => ({ apiRequest: vi.fn() }));
const request = vi.mocked(apiRequest);
beforeEach(() => request.mockReset());
describe("dedicated Definition API adapter", () => {
  it.each(["ALL", "DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const)(
    "uses one supported %s filter",
    async (filter) => {
      request.mockResolvedValue({ packages: [] });
      await packageDefinitionsApi.list(businessId, filter);
      expect(request).toHaveBeenCalledWith({
        method: "GET",
        url: `/businesses/${businessId}/packages`,
        params:
          filter === "ALL" ? {} : filter === "ARCHIVED" ? { archived: true } : { status: filter },
      });
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it("loads complete detail and sends dedicated create/update/status/archive/restore payloads", async () => {
    const dto = definition();
    const input = formToDefinition(definitionToForm(dto));
    request.mockResolvedValue(dto);
    expect(await packageDefinitionsApi.detail(businessId, dto.id)).toEqual(dto);
    await packageDefinitionsApi.create(businessId, {
      ...input,
      items: input.items.map(
        ({ serviceId, includedSessions, referenceUnitPriceCents, penaltyBasisCents }) => ({
          serviceId,
          includedSessions,
          referenceUnitPriceCents,
          penaltyBasisCents,
        }),
      ),
    });
    await packageDefinitionsApi.update(businessId, dto.id, {
      ...input,
      expectedRevision: 3,
    });
    expect(request).toHaveBeenLastCalledWith({
      method: "PATCH",
      url: `/businesses/${businessId}/packages/${dto.id}`,
      data: { ...input, expectedRevision: 3 },
    });
    await packageDefinitionsApi.status(businessId, dto.id, "INACTIVE", 3);
    expect(request).toHaveBeenLastCalledWith({
      method: "PATCH",
      url: `/businesses/${businessId}/packages/${dto.id}/status`,
      data: { status: "INACTIVE", expectedRevision: 3 },
    });
    await packageDefinitionsApi.archive(businessId, dto.id, 4);
    expect(request).toHaveBeenLastCalledWith({
      method: "DELETE",
      url: `/businesses/${businessId}/packages/${dto.id}`,
      params: { expectedRevision: 4 },
    });
    await packageDefinitionsApi.restore(businessId, dto.id, "ACTIVE", 5);
    expect(request).toHaveBeenLastCalledWith({
      method: "POST",
      url: `/businesses/${businessId}/packages/${dto.id}/restore`,
      data: { status: "ACTIVE", expectedRevision: 5 },
    });
    expect(
      request.mock.calls.every(
        ([call]) =>
          !call.url?.includes("bookings") &&
          !call.url?.includes("/services") &&
          !call.url?.includes("/me/"),
      ),
    ).toBe(true);
  });
  it("scopes caches by Business/filter/detail without progress keys", () => {
    expect(definitionKeys.detail(businessId, "p")).toEqual([
      "packageDefinitions",
      businessId,
      "detail",
      "p",
    ]);
    expect(definitionKeys.list(businessId, "ARCHIVED")).not.toEqual(
      definitionKeys.list("other", "ARCHIVED"),
    );
  });
});
