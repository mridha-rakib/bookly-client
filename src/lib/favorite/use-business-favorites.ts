"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth/store";
import { currentFavoriteScope, useAddFavoriteMutation, useFavoriteIdsQuery, useRemoveFavoriteMutation } from "./hooks";

// Shared across every card/controller in this identity's QueryClient. Acquire synchronously
// before invoking a mutation, including two clicks delivered before React renders pending state.
const pending = new WeakMap<QueryClient, Set<string>>();

export function useBusinessFavorites(options: { onAnonymous?: () => void } = {}) {
  const user = useAuthStore(state => state.user), status = useAuthStore(state => state.status);
  const scope = currentFavoriteScope();
  const query = useFavoriteIdsQuery(!!scope);
  const add = useAddFavoriteMutation(), remove = useRemoveFavoriteMutation();
  const client = useQueryClient(), router = useRouter();
  const businessIds = scope ? query.data?.businessIds ?? [] : [];
  const change = async (businessId: string, removeOnly = false) => {
    const current = useAuthStore.getState();
    if (current.status === "unauthenticated") {
      if (options.onAnonymous) options.onAnonymous(); else router.push("/customer");
      return;
    }
    if (!currentFavoriteScope()) {
      toast.error(current.status === "authenticated"
        ? "Favorites are available to active Customer accounts."
        : "Please restore your session before saving favorites.");
      return;
    }
    if (!scope || scope !== currentFavoriteScope()) return;
    if (!removeOnly && (!query.isSuccess || !query.data)) {
      toast.error("Favorites could not be read yet. Please try again shortly.");
      void query.refetch();
      return;
    }
    let busy = pending.get(client);
    if (!busy) { busy = new Set(); pending.set(client, busy); }
    const operationKey = `${scope}:${businessId}`;
    if (busy.has(operationKey)) return;
    busy.add(operationKey);
    try {
      await (removeOnly || businessIds.includes(businessId) ? remove : add).mutateAsync(businessId);
    } catch {
      if (scope === currentFavoriteScope()) toast.error("Your favorite could not be updated. Please try again.");
    } finally { busy.delete(operationKey); }
  };
  // Subscriptions also ensure restricted identities immediately mask cached hearts.
  return { businessIds: status === "authenticated" && user?.role === "CUSTOMER" ? businessIds : [],
    toggle: (businessId: string) => { void change(businessId); },
    remove: (businessId: string) => { void change(businessId, true); } };
}
