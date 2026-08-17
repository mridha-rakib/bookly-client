"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import { useClientQuery, useClientsQuery, useRestoreClientMutation } from "@/lib/clients/hooks";
import ClientDetails from "./ClientDetails";

interface ArchivedClientsListProps {
  businessId: string;
  onBack: () => void;
}

export default function ArchivedClientsList({ businessId, onBack }: ArchivedClientsListProps) {
  const [viewingClientId, setViewingClientId] = useState<string | null>(null);

  const archivedQuery = useClientsQuery(businessId, { archived: true, limit: 100 });
  const viewingClientQuery = useClientQuery(businessId, viewingClientId ?? undefined);
  const restoreMutation = useRestoreClientMutation();

  const handleRestore = (clientId: string, name: string) => {
    restoreMutation.mutate(
      { businessId, clientId },
      {
        onSuccess: () => toast.success(`${name} restored`),
        onError: (error) => toast.error(toUserMessage(error)),
      },
    );
  };

  if (viewingClientId && viewingClientQuery.data) {
    const dto = viewingClientQuery.data;
    return (
      <ClientDetails
        clientFirstName={dto.firstName}
        clientLastName={dto.lastName ?? ""}
        clientEmail={dto.email}
        clientGender={dto.gender ? dto.gender[0]!.toUpperCase() + dto.gender.slice(1) : ""}
        clientDob={dto.dateOfBirth ?? ""}
        clientPhone={`${dto.phone.countryCode} ${dto.phone.nationalNumber}`}
        clientCity={dto.address.city}
        clientPropertyType={dto.address.propertyType}
        clientArea={dto.address.area}
        clientStreetName={dto.address.streetName}
        clientStreetNumber={dto.address.streetNumber}
        clientFloor={dto.address.floorUnit ?? ""}
        clientAptNo={dto.address.aptRoom ?? ""}
        isLinked={dto.linkState === "LINKED"}
        setIsViewingClient={() => setViewingClientId(null)}
        setEditingClientIndex={() => setViewingClientId(null)}
      />
    );
  }

  const clients = archivedQuery.data?.clients ?? [];

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] relative">
      <DashboardHeader title="Archived Clients" subtitle="Clients removed from your active list" />
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-500 hover:text-neutral-900 font-poppins select-none w-fit"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} className="w-4 h-4 text-neutral-600" />
          <span>Back to Clients</span>
        </button>

        <div className="bg-white border border-[#E8E8E6] rounded-xl flex-1 flex flex-col overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAFAF8] border-b border-[#E8E8E6] text-[11px] text-[#888780] font-normal font-poppins">
                  <th className="px-5 py-3.5 font-normal">Client</th>
                  <th className="px-5 py-3.5 font-normal">Phone</th>
                  <th className="px-5 py-3.5 font-normal">Email</th>
                  <th className="px-5 py-3.5 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E6] font-poppins text-xs">
                {archivedQuery.isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-neutral-500">
                      Loading archived clients…
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-neutral-500">
                      No archived clients.
                    </td>
                  </tr>
                ) : (
                  clients.map((client) => (
                    <tr key={client.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-[#1A1A1A]">
                          {`${client.firstName} ${client.lastName ?? ""}`.trim()}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[#5F5E5A]">
                        {client.phone.countryCode} {client.phone.nationalNumber}
                      </td>
                      <td className="px-5 py-3.5 text-[#5F5E5A]">{client.email}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setViewingClientId(client.id)}
                            className="border border-[#111827] rounded-full px-3 py-1 text-xs font-semibold text-[#111827] hover:bg-neutral-50 transition-colors h-[30px]"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleRestore(client.id, client.firstName)}
                            disabled={restoreMutation.isPending}
                            className="bg-[#111111] text-white rounded-full px-3 py-1 text-xs font-semibold hover:bg-neutral-800 transition-colors h-[30px] disabled:opacity-60"
                          >
                            Restore
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
