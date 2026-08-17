"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Plus as PlusIcon } from "@hugeicons/core-free-icons";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import { useMyBusinessProfileQuery } from "@/lib/business/hooks";
import type { Addon } from "@/lib/api/addons";
import { useAddonsQuery, useArchiveAddonMutation, useUpdateAddonStatusMutation } from "@/lib/addons/hooks";
import AddonCard from "./AddonCard";
import AddonForm from "./AddonForm";

type ViewState = { mode: "list" } | { mode: "create" } | { mode: "edit" | "view"; addonId: string };

export default function AddonsListPage() {
  const [view, setView] = useState<ViewState>({ mode: "list" });
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // Add-ons are Business-Owner-only management functionality — always the owner's own
  // Primary Business, same pattern as Services (see ServicesListPage.tsx).
  const businessProfileQuery = useMyBusinessProfileQuery();
  const businessId = businessProfileQuery.data?.primary?.id ?? "";

  const addonsQuery = useAddonsQuery(businessId || undefined, {});
  const updateStatusMutation = useUpdateAddonStatusMutation();
  const archiveMutation = useArchiveAddonMutation();

  const loadError = businessProfileQuery.isError
    ? toUserMessage(businessProfileQuery.error)
    : addonsQuery.isError
      ? toUserMessage(addonsQuery.error)
      : undefined;

  useEffect(() => {
    if (loadError) {
      toast.error(loadError);
    }
  }, [loadError]);

  if (view.mode !== "list") {
    return (
      <AddonForm
        businessId={businessId}
        mode={view.mode}
        addonId={"addonId" in view ? view.addonId : undefined}
        onDone={() => setView({ mode: "list" })}
      />
    );
  }

  const addons = addonsQuery.data?.addons ?? [];
  const counts = addonsQuery.data?.counts ?? { draft: 0, active: 0, inactive: 0, archived: 0 };

  const handleToggleActive = (addon: Addon) => {
    updateStatusMutation.mutate(
      { businessId, addonId: addon.id, status: addon.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
      { onError: (error) => toast.error(toUserMessage(error)) }
    );
  };

  const handleDelete = (addon: Addon) => {
    setArchivingId(addon.id);
    archiveMutation.mutate(
      { businessId, addonId: addon.id },
      {
        onError: (error) => toast.error(toUserMessage(error)),
        onSettled: () => setArchivingId(null)
      }
    );
  };

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] md: select-none font-poppins relative">
      <DashboardHeader title="Add-ons" subtitle="Manage extra services clients can add to bookings" />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">
        {/* Control row: Stats pill & Create Add-on button */}
        <div className="flex justify-between items-center w-full mb-5 gap-4">
          <div className="bg-white border border-[#F5F5F4] rounded-full py-2 px-4 shadow-sm flex items-center gap-4 text-sm font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#1D9E75] rounded-full" />
              <span className="text-[#1F8900]">{counts.active} Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#BCB8B5] rounded-full" />
              <span className="text-[#79716B]">{counts.draft} Draft</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setView({ mode: "create" })}
            disabled={!businessId}
            className="bg-[#111111] hover:bg-black text-white text-[13px] font-medium px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <HugeiconsIcon icon={PlusIcon} className="w-3.5 h-3.5" />
            <span>Create Add-on</span>
          </button>
        </div>

        {addonsQuery.isLoading ? (
          <div className="text-sm text-neutral-500 py-10 text-center">Loading add-ons…</div>
        ) : addons.length === 0 ? (
          <div className="text-sm text-neutral-500 py-10 text-center">
            No add-ons yet. Create your first add-on to offer it alongside your services.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full">
            {addons.map((addon) => (
              <AddonCard
                key={addon.id}
                addon={addon}
                onToggleActive={handleToggleActive}
                isMenuOpen={activeMenuId === addon.id}
                onMenuClick={(id) => setActiveMenuId(id)}
                onViewClick={(a) => setView({ mode: "view", addonId: a.id })}
                onEditClick={(a) => setView({ mode: "edit", addonId: a.id })}
                onDeleteClick={handleDelete}
                isMutating={
                  (updateStatusMutation.isPending && updateStatusMutation.variables?.addonId === addon.id) ||
                  archivingId === addon.id
                }
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
