"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  staffApi,
  type CreateStaffInput,
  type CreateTimeOffInput,
  type PutScheduleInput,
  type UpdateStaffInput,
} from "@/lib/api/staff";

// Schedule and time off are embedded per-member in the Staff list DTO (see
// api/src/modules/staff/staff.service.ts listStaff — batched, no N+1), so there is a
// single business-scoped cache key that already contains everything the Staff page needs.
// Every schedule/time-off mutation invalidates this same key rather than maintaining
// separate per-member cache entries that would just duplicate what's already cached here.
export const staffKeys = {
  all: ["staff"] as const,
  list: (businessId: string) => [...staffKeys.all, "list", businessId] as const,
};

export const useStaffListQuery = (businessId: string | undefined) =>
  useQuery({
    queryKey: staffKeys.list(businessId ?? ""),
    queryFn: () => staffApi.listStaff(businessId as string),
    enabled: Boolean(businessId),
  });

export const useCreateStaffMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, input }: { businessId: string; input: CreateStaffInput }) =>
      staffApi.createStaff(businessId, input),
    onSuccess: (_invitation, variables) => {
      void queryClient.invalidateQueries({ queryKey: staffKeys.list(variables.businessId) });
    },
  });
};

/** Phase 2D — re-send a still-pending staff invitation with a fresh link. */
export const useResendStaffInvitationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, invitationId }: { businessId: string; invitationId: string }) =>
      staffApi.resendInvitation(businessId, invitationId),
    onSuccess: (_invitation, variables) => {
      void queryClient.invalidateQueries({ queryKey: staffKeys.list(variables.businessId) });
    },
  });
};

/** Phase 2D — cancel a still-pending staff invitation. */
export const useRevokeStaffInvitationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, invitationId }: { businessId: string; invitationId: string }) =>
      staffApi.revokeInvitation(businessId, invitationId),
    onSuccess: (_void, variables) => {
      void queryClient.invalidateQueries({ queryKey: staffKeys.list(variables.businessId) });
    },
  });
};

export const useUpdateStaffMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      staffId,
      input,
    }: {
      businessId: string;
      staffId: string;
      input: UpdateStaffInput;
    }) => staffApi.updateStaff(businessId, staffId, input),
    onSuccess: (_member, variables) => {
      void queryClient.invalidateQueries({ queryKey: staffKeys.list(variables.businessId) });
    },
  });
};

export const useUploadStaffAvatarMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      staffId,
      file,
    }: {
      businessId: string;
      staffId: string;
      file: File;
    }) => staffApi.uploadStaffAvatar(businessId, staffId, file),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: staffKeys.list(variables.businessId) });
    },
  });
};

export const useRemoveStaffMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, staffId }: { businessId: string; staffId: string }) =>
      staffApi.removeStaff(businessId, staffId),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: staffKeys.list(variables.businessId) });
    },
  });
};

export const usePutStaffScheduleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      staffId,
      input,
    }: {
      businessId: string;
      staffId: string;
      input: PutScheduleInput;
    }) => staffApi.putSchedule(businessId, staffId, input),
    onSuccess: (_schedule, variables) => {
      void queryClient.invalidateQueries({ queryKey: staffKeys.list(variables.businessId) });
    },
  });
};

export const useCreateStaffTimeOffMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      staffId,
      input,
    }: {
      businessId: string;
      staffId: string;
      input: CreateTimeOffInput;
    }) => staffApi.createTimeOff(businessId, staffId, input),
    onSuccess: (_entry, variables) => {
      void queryClient.invalidateQueries({ queryKey: staffKeys.list(variables.businessId) });
    },
  });
};

export const useRemoveStaffTimeOffMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      staffId,
      timeOffId,
    }: {
      businessId: string;
      staffId: string;
      timeOffId: string;
    }) => staffApi.removeTimeOff(businessId, staffId, timeOffId),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: staffKeys.list(variables.businessId) });
    },
  });
};
