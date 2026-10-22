"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  packageDefinitionsApi,
  type DefinitionFilter,
  type DefinitionInput,
  type EditableDefinitionStatus,
  type PackageDefinition,
} from "@/lib/api/package-definitions";

export const definitionKeys = {
  business: (id: string) => ["packageDefinitions", id] as const,
  list: (id: string, filter: DefinitionFilter) =>
    [...definitionKeys.business(id), "list", filter] as const,
  detail: (id: string, packageId: string) =>
    [...definitionKeys.business(id), "detail", packageId] as const,
};
export const useDefinitionsQuery = (businessId: string | undefined, filter: DefinitionFilter) =>
  useQuery({
    queryKey: definitionKeys.list(businessId ?? "", filter),
    queryFn: () => packageDefinitionsApi.list(businessId!, filter),
    enabled: Boolean(businessId),
  });
export const useDefinitionQuery = (businessId: string | undefined, id: string | undefined) =>
  useQuery({
    queryKey: definitionKeys.detail(businessId ?? "", id ?? ""),
    queryFn: () => packageDefinitionsApi.detail(businessId!, id!),
    enabled: Boolean(businessId && id),
  });
export type DefinitionAction =
  | { kind: "create"; input: DefinitionInput }
  | {
      kind: "update";
      id: string;
      input: DefinitionInput & { expectedRevision: number };
    }
  | {
      kind: "status";
      id: string;
      status: EditableDefinitionStatus;
      revision: number;
    }
  | { kind: "archive"; id: string; revision: number }
  | {
      kind: "restore";
      id: string;
      status: "ACTIVE" | "INACTIVE";
      revision: number;
    };
export const useDefinitionMutation = (businessId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (action: DefinitionAction): Promise<PackageDefinition | void> => {
      if (!businessId) throw new Error("Choose an available Business first.");
      switch (action.kind) {
        case "create":
          return packageDefinitionsApi.create(businessId, action.input);
        case "update":
          return packageDefinitionsApi.update(businessId, action.id, action.input);
        case "status":
          return packageDefinitionsApi.status(
            businessId,
            action.id,
            action.status,
            action.revision,
          );
        case "archive":
          return packageDefinitionsApi.archive(businessId, action.id, action.revision);
        case "restore":
          return packageDefinitionsApi.restore(
            businessId,
            action.id,
            action.status,
            action.revision,
          );
      }
    },
    onSuccess: (definition, action) => {
      if (definition)
        client.setQueryData(definitionKeys.detail(businessId, definition.id), definition);
      if (action.kind === "archive")
        void client.invalidateQueries({
          queryKey: definitionKeys.detail(businessId, action.id),
        });
      void client.invalidateQueries({
        queryKey: [...definitionKeys.business(businessId), "list"],
      });
    },
  });
};
