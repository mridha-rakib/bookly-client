"use client";

import { useEffect, useRef, useState } from "react";
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
  const pendingActions = useRef(new Set<string>());
  const [archiveCandidate, setArchiveCandidate] = useState<Addon | null>(null);

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
    if (pendingActions.current.has(addon.id)) return;
    pendingActions.current.add(addon.id);
    updateStatusMutation.mutate(
      { businessId, addonId: addon.id, status: addon.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
      { onError: (error) => toast.error(toUserMessage(error)), onSettled: () => pendingActions.current.delete(addon.id) }
    );
  };

  const handleDelete = (addon: Addon) => {
    if (pendingActions.current.has(addon.id)) return;
    pendingActions.current.add(addon.id);
    setArchivingId(addon.id);
    archiveMutation.mutate(
      { businessId, addonId: addon.id },
      {
        onSuccess: () => setArchiveCandidate(null),
        onError: (error) => toast.error(toUserMessage(error)),
        onSettled: () => { pendingActions.current.delete(addon.id); setArchivingId(null); }
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
              <span className="text-[#1F8900]">{loadError || businessProfileQuery.isLoading || addonsQuery.isLoading ? "—" : counts.active} Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#BCB8B5] rounded-full" />
              <span className="text-[#79716B]">{loadError || businessProfileQuery.isLoading || addonsQuery.isLoading ? "—" : counts.draft} Draft</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setView({ mode: "create" })}
            disabled={!businessId || businessProfileQuery.isError}
            className="bg-[#111111] hover:bg-black text-white text-[13px] font-medium px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <HugeiconsIcon icon={PlusIcon} className="w-3.5 h-3.5" />
            <span>Create Add-on</span>
          </button>
        </div>

        {businessProfileQuery.isError || addonsQuery.isError ? (
          <div role="alert" className="text-sm text-red-700 py-10 text-center">
            <p>Add-ons could not be loaded.</p>
            <button type="button" disabled={businessProfileQuery.isFetching || addonsQuery.isFetching} onClick={() => { if (businessProfileQuery.isError) void businessProfileQuery.refetch(); else void addonsQuery.refetch(); }} className="mt-2 underline disabled:opacity-50">{businessProfileQuery.isFetching || addonsQuery.isFetching ? "Retrying…" : "Retry add-ons"}</button>
          </div>
        ) : businessProfileQuery.isLoading || addonsQuery.isLoading ? (
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
                onDeleteClick={setArchiveCandidate}
                isMutating={
                  (updateStatusMutation.isPending && updateStatusMutation.variables?.addonId === addon.id) ||
                  archivingId === addon.id
                }
              />
            ))}
          </div>
        )}
      </div>
      {archiveCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="archive-addon-title" className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h2 id="archive-addon-title" className="font-semibold">Archive {archiveCandidate.name}?</h2>
            <p className="mt-2 text-sm text-neutral-600">The add-on will no longer be offered for new bookings. You can restore it later.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" disabled={Boolean(archivingId)} onClick={() => setArchiveCandidate(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button type="button" disabled={Boolean(archivingId)} onClick={() => handleDelete(archiveCandidate)} className="rounded-lg bg-[#1C1B1C] px-4 py-2 text-sm text-white disabled:opacity-50">{archivingId ? "Archiving…" : "Archive"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
