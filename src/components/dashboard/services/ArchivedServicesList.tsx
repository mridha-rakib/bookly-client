"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon, UserGroup03Icon as UsersIcon } from "@hugeicons/core-free-icons";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import { useMyBusinessProfileQuery } from "@/lib/business/hooks";
import type { Service } from "@/lib/api/services";
import { formatAssignedStaffSummary, formatServiceDuration, formatServicePrice } from "@/lib/services/format";
import { useRestoreServiceMutation, useServicesQuery } from "@/lib/services/hooks";
import ServiceForm from "./ServiceForm";

export default function ArchivedServicesList() {
  const [viewingServiceId, setViewingServiceId] = useState<string | null>(null);
  const [restoringService, setRestoringService] = useState<Service | null>(null);

  const businessProfileQuery = useMyBusinessProfileQuery();
  const businessId = businessProfileQuery.data?.primary?.id ?? "";

  const servicesQuery = useServicesQuery(businessId || undefined, { archived: true });
  const restoreMutation = useRestoreServiceMutation();

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

  if (viewingServiceId) {
    return (
      <ServiceForm
        businessId={businessId}
        mode="view"
        serviceId={viewingServiceId}
        onDone={() => setViewingServiceId(null)}
      />
    );
  }

  const services = servicesQuery.data?.services ?? [];

  const handleRestore = (status: "ACTIVE" | "INACTIVE") => {
    if (!restoringService) return;
    restoreMutation.mutate(
      { businessId, serviceId: restoringService.id, status },
      {
        onSuccess: () => {
          toast.success(`Service restored as ${status === "ACTIVE" ? "Active" : "Inactive"}`);
          setRestoringService(null);
        },
        onError: (error) => toast.error(toUserMessage(error))
      }
    );
  };

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] md: select-none font-poppins relative">
      <DashboardHeader title="Archived Services" subtitle="Services removed from your active catalogue" />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">
        {servicesQuery.isLoading ? (
          <div className="text-sm text-neutral-500 py-10 text-center">Loading archived services…</div>
        ) : services.length === 0 ? (
          <div className="text-sm text-neutral-500 py-10 text-center">No archived services.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full">
            {services.map((service) => {
              const price = formatServicePrice(service);
              const duration = formatServiceDuration(service);
              const staffSummary = formatAssignedStaffSummary(service.assignedStaff);
              return (
                <div
                  key={service.id}
                  className="bg-white border border-[#F5F5F4] rounded-2xl p-6 flex flex-col justify-between shadow-sm min-h-[320px] opacity-90"
                >
                  <div>
                    <div className="flex justify-between items-start border-b border-neutral-100 pb-3 mb-4">
                      <div className="flex flex-col">
                        <h3 className="font-semibold text-lg text-[#1C1917] leading-7">{service.name}</h3>
                        <span className="text-xs font-light text-[#757575] mt-0.5">{service.serviceCategoryName}</span>
                      </div>
                      <span className="bg-neutral-100 text-neutral-500 text-xs font-medium px-2.5 py-1 rounded-full">
                        Archived
                      </span>
                    </div>

                    <div className="flex items-baseline gap-1 mb-6">
                      <span className="text-2xl font-bold text-[#1C1917] tracking-tight">{price.amount}</span>
                      {price.suffix && <span className="text-xs text-[#757575] font-normal">{price.suffix}</span>}
                    </div>

                    <div className="flex flex-col gap-3">
                      {duration && (
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-3 text-neutral-500">
                            <HugeiconsIcon icon={Clock01Icon} className="w-4 h-4" />
                            <span>Duration</span>
                          </div>
                          <span className="font-medium text-[#111111]">{duration}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3 text-neutral-500">
                          <HugeiconsIcon icon={UsersIcon} className="w-4 h-4" />
                          <span>Staff</span>
                        </div>
                        <span className="font-medium text-[#111111]">{staffSummary.primary}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[#F5F5F4] pt-4 mt-5 shrink-0 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setViewingServiceId(service.id)}
                      className="h-[32px] px-4 bg-[#EBEBEB] text-[#757575] font-poppins font-medium text-xs rounded-[8px] hover:bg-[#E2E2E2] transition-colors cursor-pointer"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestoringService(service)}
                      className="h-[32px] px-4 bg-[#1C1B1C] hover:bg-black text-white font-poppins font-medium text-xs rounded-[8px] transition-colors cursor-pointer"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {restoringService && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-poppins font-semibold text-base text-[#111111]">Restore service</span>
              <span className="font-poppins font-normal text-sm text-neutral-500">
                Restore &quot;{restoringService.name}&quot; as:
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={restoreMutation.isPending}
                onClick={() => handleRestore("ACTIVE")}
                className="h-[40px] rounded-lg bg-[#1C1B1C] hover:bg-black text-white font-poppins font-medium text-sm disabled:opacity-60 cursor-pointer"
              >
                Active
              </button>
              <button
                type="button"
                disabled={restoreMutation.isPending}
                onClick={() => handleRestore("INACTIVE")}
                className="h-[40px] rounded-lg bg-[#EBEBEB] text-[#111111] font-poppins font-medium text-sm hover:bg-[#E2E2E2] disabled:opacity-60 cursor-pointer"
              >
                Inactive
              </button>
            </div>
            <button
              type="button"
              onClick={() => setRestoringService(null)}
              className="text-xs text-neutral-500 hover:text-black self-center cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
