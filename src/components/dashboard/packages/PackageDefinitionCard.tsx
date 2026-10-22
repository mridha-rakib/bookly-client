"use client";

import { useRef, type ReactNode } from "react";
import type { PackageDefinition } from "@/lib/api/package-definitions";
import { DefinitionIssues, DefinitionStatus, euro, validityLabel } from "./PackagePresentation";

export default function PackageDefinitionCard({
  definition,
  busy,
  actionsDisabled,
  onView,
  onEdit,
  onArchive,
  onStatus,
  onRestore,
  children,
}: {
  definition: PackageDefinition;
  busy: boolean;
  actionsDisabled: boolean;
  onView: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onStatus: (status: "ACTIVE" | "INACTIVE") => void;
  onRestore: (status: "ACTIVE" | "INACTIVE") => void;
  children?: ReactNode;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const action = (run: () => void) => () => {
    if (menu.current) menu.current.open = false;
    run();
  };
  const menuClass =
    "w-full px-4 py-2 text-left text-xs font-medium hover:bg-neutral-50 focus-visible:outline-none focus-visible:bg-[#E9F1F2] disabled:opacity-50";
  const setupIncomplete =
    definition.dependencyIssues.length > 0 ||
    !definition.contractTerms ||
    definition.items.some((item) => item.penaltyBasisCents === undefined);
  return (
    <article
      aria-label={definition.name}
      className="flex min-w-0 flex-col rounded-2xl border border-[#F5F5F4] bg-white p-6 shadow-sm"
    >
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-neutral-100 pb-4">
        <div className="min-w-0">
          <h2
            title={definition.name}
            className="min-h-14 line-clamp-2 break-words text-lg font-semibold leading-7 text-[#1C1917]"
          >
            {definition.name}
          </h2>
          <p className="mt-1 break-words text-xs font-light text-[#757575]">
            {definition.subcategory || "Package"}
          </p>
        </div>
        <details
          ref={menu}
          className="relative shrink-0"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              event.currentTarget.open = false;
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary
            aria-label={`Actions for ${definition.name}`}
            className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7] [&::-webkit-details-marker]:hidden"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </summary>
          <div className="absolute right-0 top-9 z-30 w-40 rounded-lg border border-[#EFEFED] bg-white py-1.5 text-[#111111] shadow-lg">
            <button
              type="button"
              className={menuClass}
              aria-label={`View ${definition.name}`}
              disabled={busy}
              onClick={action(onView)}
            >
              View
            </button>
            <button
              type="button"
              className={menuClass}
              aria-label={`Edit ${definition.name}`}
              disabled={busy}
              onClick={action(onEdit)}
            >
              Edit
            </button>
            {definition.status === "ARCHIVED" ? (
              <>
                <button
                  type="button"
                  className={menuClass}
                  aria-label={`Restore ${definition.name} as inactive`}
                  disabled={actionsDisabled}
                  onClick={action(() => onRestore("INACTIVE"))}
                >
                  Restore inactive
                </button>
                <button
                  type="button"
                  className={menuClass}
                  aria-label={`Restore ${definition.name} as active`}
                  disabled={actionsDisabled}
                  onClick={action(() => onRestore("ACTIVE"))}
                >
                  Restore active
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={menuClass}
                  aria-label={`${definition.status === "ACTIVE" ? "Deactivate" : "Activate"} ${definition.name}`}
                  disabled={actionsDisabled}
                  onClick={action(() =>
                    onStatus(definition.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"),
                  )}
                >
                  {definition.status === "ACTIVE" ? "Deactivate" : "Activate"}
                </button>
                {definition.status === "DRAFT" && (
                  <button
                    type="button"
                    className={menuClass}
                    aria-label={`Publish ${definition.name} as inactive`}
                    disabled={actionsDisabled}
                    onClick={action(() => onStatus("INACTIVE"))}
                  >
                    Publish inactive
                  </button>
                )}
                <button
                  type="button"
                  className={`${menuClass} text-[#D85A30]`}
                  aria-label={`Archive ${definition.name}`}
                  disabled={actionsDisabled}
                  onClick={action(onArchive)}
                >
                  Archive
                </button>
              </>
            )}
          </div>
        </details>
      </div>
      <p className="mb-5 break-words text-2xl font-bold tracking-tight text-[#1C1917]">
        {euro(definition.bundlePriceCents)}
      </p>
      <dl className="mb-5 space-y-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-[#757575]">Included sessions</dt>
          <dd className="font-medium text-[#111111]">{definition.totalSessions}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[#757575]">Validity</dt>
          <dd className="font-medium text-[#111111]">{validityLabel(definition)}</dd>
        </div>
      </dl>
      {setupIncomplete && (
        <div className="mt-4 space-y-2 text-xs">
          <p className="font-medium text-[#824E1B]">Setup incomplete</p>
          <DefinitionIssues definition={definition} />
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#F5F5F4] pt-4">
        <DefinitionStatus status={definition.status} />
        {definition.status !== "ARCHIVED" && (
          <button
            type="button"
            role="switch"
            aria-checked={definition.status === "ACTIVE"}
            aria-label={`Active status for ${definition.name}`}
            disabled={actionsDisabled || definition.status === "DRAFT"}
            onClick={() => onStatus(definition.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
            className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7] focus-visible:ring-offset-2 disabled:opacity-50 ${definition.status === "ACTIVE" ? "bg-[#8EBAC5]" : "bg-neutral-300"}`}
          >
            <span
              className={`h-4 w-4 rounded-full bg-white transition-transform ${definition.status === "ACTIVE" ? "translate-x-4" : "translate-x-0"}`}
            />
          </button>
        )}
      </div>
      {children}
    </article>
  );
}
