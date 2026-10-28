"use client";

import { useState } from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { toast } from "@/components/ui/sonner";
import { useMyBusinessProfileQuery } from "@/lib/business/hooks";
import { normalizeApiError } from "@/lib/api/client";
import type { DefinitionFilter, PackageDefinition } from "@/lib/api/package-definitions";
import {
  useDefinitionMutation,
  useDefinitionsQuery,
  type DefinitionAction,
} from "@/lib/package-definitions/hooks";
import { HugeiconsIcon } from "@hugeicons/react";
import { FilterHorizontalIcon } from "@hugeicons/core-free-icons";
import PackageDefinitionForm from "./PackageDefinitionForm";
import PackageDefinitionCard from "./PackageDefinitionCard";
import {
  buttonClass,
  primaryClass,
  DefinitionError,
  selectArrowStyle,
} from "./PackagePresentation";

type View = { mode: "list" | "create" } | { mode: "view" | "edit"; id: string };
export default function PackagesListPage() {
  const profile = useMyBusinessProfileQuery();
  const business = profile.data?.primary;
  // Primary owned Business only. The existing page additionally enforces Owner auth/approval.
  const businessId =
    business && (business.status === "APPROVED" || business.status === "WARNING")
      ? business.id
      : undefined;
  return (
    <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#FCF8F8] font-poppins">
      <DashboardHeader title="Packages" subtitle="Manage your Package catalog" />
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        {profile.isError ? (
          <DefinitionError
            error={profile.error}
            retry={() => {
              void profile.refetch();
            }}
          />
        ) : profile.isPending ? (
          <p role="status">Loading Business…</p>
        ) : !businessId ? (
          <div className="space-y-3">
            <p role="alert">
              An approved Business owned by your account is required to manage Packages.
            </p>
            <button className={buttonClass} onClick={() => void profile.refetch()}>
              Retry Business details
            </button>
          </div>
        ) : (
          <PackageManager key={businessId} businessId={businessId} />
        )}
      </div>
    </main>
  );
}

function PackageManager({ businessId }: { businessId: string }) {
  const [view, setView] = useState<View>({ mode: "list" });
  const [filter, setFilter] = useState<DefinitionFilter>("ALL");
  const [archive, setArchive] = useState<PackageDefinition>();
  const [error, setError] = useState<unknown>();
  const [stale, setStale] = useState(false);
  const list = useDefinitionsQuery(businessId, filter);
  const mutation = useDefinitionMutation(businessId);
  const run = async (action: DefinitionAction) => {
    setError(undefined);
    try {
      await mutation.mutateAsync(action);
      setArchive(undefined);
      toast.success(
        action.kind === "archive"
          ? "Package archived"
          : action.kind === "restore"
            ? "Package restored"
            : "Package status updated",
      );
    } catch (failure) {
      setError(failure);
      if (normalizeApiError(failure).code === "PACKAGE_REVISION_CONFLICT") {
        setArchive(undefined);
        setStale(true);
        await list.refetch();
      }
    }
  };
  // Keep the list mounted in the cache; mutations invalidate it without new polling.
  if (view.mode !== "list")
    return (
      <PackageDefinitionForm
        businessId={businessId}
        mode={view.mode}
        packageId={"id" in view ? view.id : undefined}
        onDone={() => {
          setView({ mode: "list" });
          setError(undefined);
        }}
      />
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex min-h-[42px] items-center gap-2.5 rounded-full border border-[#E7E5E4] bg-white px-4 py-2 text-sm font-medium text-[#57534D] shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2E9DA7] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2E9DA7]" />
            </span>
            <span>
              <strong className="font-semibold text-[#111111]">{list.data?.packages.length ?? 0}</strong>{" "}
              Packages in this view
            </span>
          </p>
          <label className="group flex min-h-[42px] items-center gap-2.5 rounded-full border border-[#E7E5E4] bg-white pl-4 pr-3 py-1.5 shadow-xs transition-colors hover:border-[#D3D1C7] cursor-pointer">
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#757575] shrink-0">
              <HugeiconsIcon icon={FilterHorizontalIcon} className="h-3.5 w-3.5 text-[#2E9DA7]" />
              <span>Show Packages</span>
            </span>
            <span className="h-4 w-[1px] bg-[#E7E5E4]" />
            <select
              className="appearance-none bg-transparent pr-7 pl-1 py-1 font-poppins text-xs font-semibold text-[#111111] focus:outline-none cursor-pointer"
              style={selectArrowStyle}
              value={filter}
              disabled={mutation.isPending}
              onChange={(e) => {
                setArchive(undefined);
                setFilter(e.target.value as DefinitionFilter);
                setError(undefined);
                setStale(false);
              }}
            >
              <option value="ALL">All nonarchived</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
        </div>
        <button
          className={primaryClass}
          disabled={mutation.isPending}
          onClick={() => setView({ mode: "create" })}
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>Create Package</span>
        </button>
      </div>
      <p className="text-xs leading-5 text-[#757575]">
        Manage catalog definitions here. Customer Package checkout is not activated by these
        settings. Existing Service Package Deals remain under Services.
      </p>
      {error !== undefined && <DefinitionError error={error} />}
      {stale && (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"
        >
          <p>The Package changed. Review the refreshed list before choosing an action again.</p>
          <button
            className={buttonClass}
            disabled={list.isFetching}
            onClick={() => {
              if (!list.isError) {
                setStale(false);
                setError(undefined);
              }
            }}
          >
            I reviewed the refreshed list
          </button>
        </div>
      )}
      {list.isError ? (
        <DefinitionError
          error={list.error}
          retry={() => {
            void list.refetch();
          }}
        />
      ) : list.isPending ? (
        <p role="status">Loading Packages…</p>
      ) : !list.data?.packages.length ? (
        <p role="status" className="py-10 text-center text-sm text-neutral-500">
          {filter === "ARCHIVED"
            ? "No archived Packages."
            : "No Packages match this view. Create a Package to get started."}
        </p>
      ) : (
        <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.data.packages.map((definition) => (
            <PackageDefinitionCard
              key={definition.id}
              definition={definition}
              busy={mutation.isPending}
              actionsDisabled={mutation.isPending || stale || list.isFetching}
              onView={() => setView({ mode: "view", id: definition.id })}
              onEdit={() => setView({ mode: "edit", id: definition.id })}
              onArchive={() => setArchive(definition)}
              onStatus={(status) =>
                void run({
                  kind: "status",
                  id: definition.id,
                  revision: definition.revision,
                  status,
                })
              }
              onRestore={(status) =>
                void run({
                  kind: "restore",
                  id: definition.id,
                  revision: definition.revision,
                  status,
                })
              }
            >
              {archive?.id === definition.id && (
                <section
                  role="alertdialog"
                  aria-modal="false"
                  aria-labelledby="archive-package-title"
                  className="mt-4 space-y-3 rounded-xl border border-[#EFEFED] bg-[#F5F4EE] p-4"
                >
                  <h2 id="archive-package-title" className="font-semibold">
                    Archive {archive.name}?
                  </h2>
                  <p className="text-sm">
                    This removes the definition from the nonarchived catalog. Its terms and items
                    are retained, and you can restore it from Archived.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      className={primaryClass}
                      disabled={mutation.isPending}
                      onClick={() =>
                        void run({
                          kind: "archive",
                          id: archive.id,
                          revision: archive.revision,
                        })
                      }
                    >
                      {mutation.isPending ? "Archiving…" : "Confirm archive"}
                    </button>
                    <button
                      className={buttonClass}
                      disabled={mutation.isPending}
                      onClick={() => setArchive(undefined)}
                    >
                      Keep Package
                    </button>
                  </div>
                </section>
              )}
            </PackageDefinitionCard>
          ))}
        </div>
      )}
    </div>
  );
}
