"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Plus as PlusIcon } from "@hugeicons/core-free-icons";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import { useMyBusinessProfileQuery } from "@/lib/business/hooks";
import { useCancellationPolicyQuery } from "@/lib/business/cancellation-policy-hooks";
import { useAddonsQuery } from "@/lib/addons/hooks";
import {
  useArchiveServiceMutation,
  useBookingSettingsQuery,
  useServicesQuery,
  useUpdateBookingSettingsMutation,
  useUpdateServiceStatusMutation
} from "@/lib/services/hooks";
import ServiceCard from "./ServiceCard";
import ServiceForm from "./ServiceForm";

type ViewState = { mode: "list" } | { mode: "create" } | { mode: "edit" | "view"; serviceId: string };

export default function ServicesListPage() {
  const [view, setView] = useState<ViewState>({ mode: "list" });
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // Services are Business-Owner-only management functionality — always the owner's own
  // Primary Business, same pattern as Staff (see DashboardStaffList.tsx).
  const businessProfileQuery = useMyBusinessProfileQuery();
  const businessId = businessProfileQuery.data?.primary?.id ?? "";

  const servicesQuery = useServicesQuery(businessId || undefined, {});
  const bookingSettingsQuery = useBookingSettingsQuery(businessId || undefined);
  const cancellationPolicyQuery = useCancellationPolicyQuery(businessId || undefined);
  // Single business-scoped fetch of active Add-ons (each carrying its own assignedServices) —
  // avoids issuing one Add-ons request per card.
  const activeAddonsQuery = useAddonsQuery(businessId || undefined, { status: "ACTIVE" });
  const updateStatusMutation = useUpdateServiceStatusMutation();
  const archiveMutation = useArchiveServiceMutation();
  const updateBookingSettingsMutation = useUpdateBookingSettingsMutation();

  const loadError = businessProfileQuery.isError
    ? toUserMessage(businessProfileQuery.error)
    : servicesQuery.isError
      ? toUserMessage(servicesQuery.error)
      : undefined;

  useEffect(() => {
    if (loadError) {
      toast.error(loadError);
    }
  }, [loadError]);

  if (view.mode !== "list") {
    return (
      <ServiceForm
        businessId={businessId}
        mode={view.mode}
        serviceId={"serviceId" in view ? view.serviceId : undefined}
        onDone={() => setView({ mode: "list" })}
      />
    );
  }

  const services = servicesQuery.data?.services ?? [];
  const counts = servicesQuery.data?.counts ?? { draft: 0, active: 0, inactive: 0, archived: 0 };
  const gapEliminationEnabled = bookingSettingsQuery.data?.gapEliminationEnabled ?? false;

  // Business-wide policy, not a Service field — undefined (never a fabricated default) unless
  // the policy has actually been configured and successfully loaded.
  const noShowPercentage = cancellationPolicyQuery.data?.configured
    ? cancellationPolicyQuery.data.noShowPercentage
    : undefined;

  // Count of currently-active Add-ons assigned to each Service — derived client-side from the
  // one shared active-Addons fetch above, never counting archived/inactive Add-ons or rows
  // belonging to another Service.
  const addonCountByServiceId = new Map<string, number>();
  for (const addon of activeAddonsQuery.data?.addons ?? []) {
    for (const assignment of addon.assignedServices) {
      addonCountByServiceId.set(
        assignment.serviceId,
        (addonCountByServiceId.get(assignment.serviceId) ?? 0) + 1
      );
    }
  }

  const handleToggleActive = (serviceId: string, currentlyActive: boolean) => {
    updateStatusMutation.mutate(
      { businessId, serviceId, status: currentlyActive ? "INACTIVE" : "ACTIVE" },
      { onError: (error) => toast.error(toUserMessage(error)) }
    );
  };

  const handleArchive = (serviceId: string) => {
    setArchivingId(serviceId);
    archiveMutation.mutate(
      { businessId, serviceId },
      {
        onError: (error) => toast.error(toUserMessage(error)),
        onSettled: () => setArchivingId(null)
      }
    );
  };

  const handleGapEliminationToggle = () => {
    updateBookingSettingsMutation.mutate(
      { businessId, gapEliminationEnabled: !gapEliminationEnabled },
      { onError: (error) => toast.error(toUserMessage(error)) }
    );
  };

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] md: select-none font-poppins relative">
      <DashboardHeader title="Services" subtitle="Manage your service catalogue" />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">
        {/* Control row: Stats pill & Create Service button */}
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
            <span>Create Service</span>
          </button>
        </div>

        {/* Gap Elimination Section — business-scoped, not per-Service */}
        <div className="bg-white rounded-xl p-[18px] px-5 w-full flex flex-col gap-4 shadow-sm border border-[#F5F5F4] mb-5">
          <div className="flex justify-between items-center w-full">
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-sm text-[#111111]">Gap Elimination</span>
              <span className="text-xs text-neutral-500">Fill your day like Tetris. No useless gaps between appointments.</span>
            </div>
            <button
              type="button"
              onClick={handleGapEliminationToggle}
              disabled={!businessId || updateBookingSettingsMutation.isPending}
              className={`w-[38px] h-[21px] rounded-full p-[3px] transition-colors duration-200 focus:outline-none flex items-center ${gapEliminationEnabled ? "bg-[#0F6E56]" : "bg-neutral-300"}`}
            >
              <div className={`w-[15px] h-[15px] bg-white rounded-full transition-transform duration-200 ${gapEliminationEnabled ? "translate-x-[17px]" : "translate-x-0"}`} />
            </button>
          </div>
        </div>

        {servicesQuery.isLoading ? (
          <div className="text-sm text-neutral-500 py-10 text-center">Loading services…</div>
        ) : services.length === 0 ? (
          <div className="text-sm text-neutral-500 py-10 text-center">
            No services yet. Create your first service to start taking bookings.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full">
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                noShowPercentage={noShowPercentage}
                addonCount={addonCountByServiceId.get(service.id)}
                onView={() => setView({ mode: "view", serviceId: service.id })}
                onEdit={() => setView({ mode: "edit", serviceId: service.id })}
                onArchive={() => handleArchive(service.id)}
                onToggleActive={() => handleToggleActive(service.id, service.status === "ACTIVE")}
                isMutating={
                  (updateStatusMutation.isPending && updateStatusMutation.variables?.serviceId === service.id) ||
                  archivingId === service.id
                }
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
