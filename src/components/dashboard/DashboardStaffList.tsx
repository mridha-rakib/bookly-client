"use client";
import Image from "next/image";
import DashboardHeader from "@/components/dashboard/DashboardHeader";


import React, { useState, useRef, useMemo, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Plus as PlusIcon,
  ArrowLeft02Icon,
  InformationCircleIcon,
  Camera01Icon
} from "@hugeicons/core-free-icons";
import { Staff } from "@/data/staffMockData";
import StaffCard from "../staff/StaffCard";
import StaffAccessChangeModal, {
  StaffAccessChangeMode,
} from "../staff/StaffAccessChangeModal";
import StaffPhotoCropModal from "../staff/StaffPhotoCropModal";
import { Spinner } from "@/components/ui/spinner";
import StaffAvailabilityTable, { StaffAvailabilityRow } from "../staff/StaffAvailabilityTable";
import StaffRolePermissions from "../staff/StaffRolePermissions";
import { useMyBusinessProfileQuery } from "@/lib/business/hooks";
import {
  ScheduleDay,
  StaffCreatableRole,
  StaffMember,
  StaffTimeOffEntry,
  StaffTimeOffType,
  DayOfWeek
} from "@/lib/api/staff";
import {
  useStaffListQuery,
  useCreateStaffMutation,
  useUpdateStaffMutation,
  useRemoveStaffMutation,
  usePutStaffScheduleMutation,
  useCreateStaffTimeOffMutation,
  useRemoveStaffTimeOffMutation,
  useUploadStaffAvatarMutation,
  useResendStaffInvitationMutation,
  useRevokeStaffInvitationMutation
} from "@/lib/staff/hooks";
import {
  dayOrder,
  dayShortLabel,
  formatTime12Hour,
  parseTime12HourToCanonical,
  parseTimeInputText,
  sanitizeTimeDraftInput,
  timeOffTypeLabels,
  formatTimeOffRange,
  summarizeScheduleForCard,
  summarizeScheduleForTable,
  summarizeTimeOffForTable
} from "@/lib/staff/format";
import { toUserMessage } from "@/lib/auth/messages";

// Mirror of the staff-avatar backend contract so an obviously-wrong file is rejected before
// we ever open the crop modal — see api/src/modules/staff-avatar/staff-avatar.service.ts
// (allowedImageMimeTypes) and STAFF_AVATAR_MAX_UPLOAD_BYTES in api/.env (5 MB). The backend
// still re-validates (incl. magic bytes); this is just a friendlier first line.
const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_REJECT_MESSAGE = "Please choose a JPG, PNG, WebP or GIF image under 5 MB.";

const revokeIfBlob = (url: string | null | undefined): void => {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
};

const displayRole = (role: StaffMember["role"]): Staff["role"] =>
  role === "BUSINESS_OWNER" ? "Owner" : role === "SUPERVISOR" ? "Supervisor" : "Staff";

const avatarBgForRole = (role: StaffMember["role"]): string =>
  role === "BUSINESS_OWNER" ? "bg-[#7C3AED]" : role === "SUPERVISOR" ? "bg-[#EC4899]" : "bg-[#10B981]";

const initialsFor = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const formatPhone = (phone: StaffMember["phone"]): string | undefined =>
  phone ? `${phone.countryCode} ${phone.nationalNumber}` : undefined;

// Services are a deferred domain in this phase (no backend yet) — this is a neutral,
// honest placeholder, never fabricated data.
const toDisplayStaff = (member: StaffMember): Staff => ({
  id: member.membershipId ?? member.userId,
  name: member.name,
  role: displayRole(member.role),
  subRole: displayRole(member.role),
  avatarText: initialsFor(member.name),
  avatarBg: avatarBgForRole(member.role),
  servicesAssigned: "Not assigned yet",
  schedule: summarizeScheduleForCard(member.schedule),
  status: member.employmentActive ? "Active" : "Inactive",
  email: member.email,
  phone: formatPhone(member.phone),
  avatarUrl: member.avatarUrl
});

const accessTitleForRole = (role: StaffMember["role"]): string =>
  role === "BUSINESS_OWNER"
    ? "Full access"
    : role === "SUPERVISOR"
    ? "Full access"
    : "Own bookings only";

const accessSubtitleForRole = (role: StaffMember["role"]): string =>
  role === "BUSINESS_OWNER" ? "Including financials" : "No financials";

const toAvailabilityRow = (member: StaffMember): StaffAvailabilityRow => ({
  name: member.name,
  role: displayRole(member.role),
  avatarText: initialsFor(member.name),
  avatarBg: avatarBgForRole(member.role),
  shifts: summarizeScheduleForTable(member.schedule),
  timeoff: summarizeTimeOffForTable(member.timeOff),
  services: "Not assigned yet",
  accessTitle: accessTitleForRole(member.role),
  accessSubtitle: accessSubtitleForRole(member.role),
  avatarUrl: member.avatarUrl
});

type CommittedShift = { startTime: string; endTime: string };
// The actual persisted/configured weekly schedule — a day present here IS a working day
// (this is the sole source of truth for what gets submitted). Separate from `selectedDays`
// below, which is only a transient batch-edit target and must never be confused with it.
type DayScheduleState = Partial<Record<DayOfWeek, CommittedShift>>;

export default function DashboardStaffList() {
  const [isAdding, setIsAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  // Photo picking now goes through a crop step: a valid pick opens the crop modal
  // (cropSource = the raw object URL); only "Use photo" stages a cropped File.
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropBaseName, setCropBaseName] = useState<string | undefined>(undefined);
  const [photoError, setPhotoError] = useState("");

  // Form states for adding new staff
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<StaffCreatableRole>("SUPERVISOR");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffEmploymentActive, setStaffEmploymentActive] = useState(true);

  // --- Working Hours state ---
  // scheduleByDay: the real, persisted-on-save weekly schedule (one shift per day, max).
  // selectedDays: which weekday chips are currently the batch-edit target — purely a UI
  // selection, never itself a record of "this day is working" (see handleAddHours /
  // handleRemoveSelectedDaysHours below for how the two interact).
  const [scheduleByDay, setScheduleByDay] = useState<DayScheduleState>({});
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]);
  // Raw draft text ("H:MM"/"HH:MM", no AM/PM) for the Start/End Shift inputs — kept as a
  // single tolerant string per STEP 6 rather than split hour/minute fields, so typing
  // "9" -> "9:" -> "9:2" -> "9:20" is never fought/reformatted mid-keystroke. Strict parsing
  // (via parseTimeInputText) only happens on Add Hours / Save.
  const [startTimeText, setStartTimeText] = useState("");
  const [periodInput, setPeriodInput] = useState<"AM" | "PM">("AM");
  const [endTimeText, setEndTimeText] = useState("");
  const [endPeriodInput, setEndPeriodInput] = useState<"PM" | "AM">("PM");
  const [scheduleFieldError, setScheduleFieldError] = useState("");

  // --- Time off state ---
  const [timeOffEntries, setTimeOffEntries] = useState<StaffTimeOffEntry[]>([]);
  const [newLeaveType, setNewLeaveType] = useState<StaffTimeOffType>("ANNUAL_HOLIDAY");
  const [newLeaveDate, setNewLeaveDate] = useState("2026-06-02");
  const [newLeaveEndDate, setNewLeaveEndDate] = useState("");
  const [timeOffError, setTimeOffError] = useState("");
  const [timeOffBusyId, setTimeOffBusyId] = useState<string | null>(null);

  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dedicated two-step confirmation flow for role / deactivate / reactivate.
  const [accessChange, setAccessChange] = useState<{
    mode: StaffAccessChangeMode;
    member: StaffMember;
  } | null>(null);
  const [accessChangeError, setAccessChangeError] = useState("");

  // Staff management always targets the authenticated Business Owner's own Business — a
  // linked/Secondary Business grants no Staff-management rights (server-enforced too, see
  // api/src/modules/staff/staff.service.ts requireOwnedStaffBusiness), so there is no
  // Business selection here, only the owned Primary Business.
  const businessProfileQuery = useMyBusinessProfileQuery();
  const effectiveBusinessId = businessProfileQuery.data?.primary?.id ?? "";

  const staffListQuery = useStaffListQuery(effectiveBusinessId || undefined);
  const staffMembers = useMemo(() => staffListQuery.data?.members ?? [], [staffListQuery.data]);
  const pendingInvitations = useMemo(
    () => staffListQuery.data?.invitations ?? [],
    [staffListQuery.data],
  );
  const displayStaffMembers = useMemo(() => staffMembers.map(toDisplayStaff), [staffMembers]);
  const availabilityRows = useMemo(() => staffMembers.map(toAvailabilityRow), [staffMembers]);
  // The staff member currently open in the big edit form. Derived from the live list so the
  // form's read-only role display refetches itself after a confirmed role change.
  const editingMember = useMemo(
    () =>
      editingStaffId ? staffMembers.find((m) => m.membershipId === editingStaffId) : undefined,
    [editingStaffId, staffMembers],
  );

  const createStaffMutation = useCreateStaffMutation();
  const resendInvitationMutation = useResendStaffInvitationMutation();
  const revokeInvitationMutation = useRevokeStaffInvitationMutation();
  const updateStaffMutation = useUpdateStaffMutation();
  const removeStaffMutation = useRemoveStaffMutation();
  const putScheduleMutation = usePutStaffScheduleMutation();
  const createTimeOffMutation = useCreateStaffTimeOffMutation();
  const removeTimeOffMutation = useRemoveStaffTimeOffMutation();
  const uploadAvatarMutation = useUploadStaffAvatarMutation();
  const avatarUploadPending = uploadAvatarMutation.isPending;

  const [actionError, setActionError] = useState("");

  const isLoading = businessProfileQuery.isLoading || staffListQuery.isLoading;
  const loadError = businessProfileQuery.isError
    ? toUserMessage(businessProfileQuery.error)
    : staffListQuery.isError
    ? toUserMessage(staffListQuery.error)
    : actionError;

  const clearTimeInputs = () => {
    setStartTimeText("");
    setPeriodInput("AM");
    setEndTimeText("");
    setEndPeriodInput("PM");
  };

  const applyTimeInputsFromShift = (shift: CommittedShift) => {
    const start = parseTime12HourInputFromCanonical(shift.startTime);
    const end = parseTime12HourInputFromCanonical(shift.endTime);
    setStartTimeText(`${start.hour}:${String(start.minute).padStart(2, "0")}`);
    setPeriodInput(start.period);
    setEndTimeText(`${end.hour}:${String(end.minute).padStart(2, "0")}`);
    setEndPeriodInput(end.period);
  };

  // Strictly parses the currently-typed Start/End draft (STEP 3/6): "empty" when the user
  // hasn't touched either field (nothing to apply), "error" when it's incomplete or invalid
  // (must block Save/Add Hours rather than silently discarding it), "valid" with the
  // resulting canonical shift otherwise. Shared by "+ Add Hours" and "Save changes" so both
  // treat a typed-but-unapplied draft identically.
  const parseDraftShift = (): { kind: "empty" } | { kind: "error"; message: string } | { kind: "valid"; shift: CommittedShift } => {
    const hasDraftText = Boolean(startTimeText.trim() || endTimeText.trim());
    if (!hasDraftText) {
      return { kind: "empty" };
    }

    const start = parseTimeInputText(startTimeText);
    const end = parseTimeInputText(endTimeText);

    if (!start || !end) {
      return { kind: "error", message: "Enter a start and end shift time" };
    }

    try {
      const startTime = parseTime12HourToCanonical(start.hour, start.minute, periodInput);
      const endTime = parseTime12HourToCanonical(end.hour, end.minute, endPeriodInput);

      if (startTime >= endTime) {
        return { kind: "error", message: "End time must be after start time" };
      }

      return { kind: "valid", shift: { startTime, endTime } };
    } catch (error) {
      return { kind: "error", message: error instanceof Error ? error.message : "Invalid time" };
    }
  };

  // Folds the current Start/End draft into the committed schedule for the selected day(s),
  // the same way "+ Add Hours" does — used by Save changes so a valid visible draft is never
  // silently discarded just because the user didn't click Add Hours first (STEP 2/3).
  // Returns the *local* merged schedule object (never reads back from React state) so the
  // caller can submit it directly instead of racing an async setState (STEP 10).
  const resolveScheduleForSave = (): { schedule: DayScheduleState; blockingError: string | null } => {
    if (selectedDays.length === 0) {
      return { schedule: scheduleByDay, blockingError: null };
    }

    const result = parseDraftShift();
    if (result.kind === "empty") {
      return { schedule: scheduleByDay, blockingError: null };
    }
    if (result.kind === "error") {
      return { schedule: scheduleByDay, blockingError: result.message };
    }

    const next = { ...scheduleByDay };
    for (const day of selectedDays) {
      next[day] = result.shift;
    }
    return { schedule: next, blockingError: null };
  };

  const resetScheduleForm = () => {
    setScheduleByDay({});
    setSelectedDays([]);
    clearTimeInputs();
    setScheduleFieldError("");
  };

  const resetTimeOffForm = () => {
    setTimeOffEntries([]);
    setNewLeaveType("ANNUAL_HOLIDAY");
    setNewLeaveDate("2026-06-02");
    setNewLeaveEndDate("");
    setTimeOffError("");
  };

  // Toggles one weekday in/out of the current batch-edit selection. This is purely a UI
  // selection — it never adds or removes a persisted shift by itself (see STEP 7: selection
  // is temporary edit-target state, not "this day is off").
  const toggleDaySelection = (day: DayOfWeek) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    setSelectedDays(next);
    setScheduleFieldError("");

    // Selecting exactly one already-configured day loads its real hours for editing (so
    // "select only that day, tweak the time, + Add Hours" works as an individual override).
    // Any other selection state (none, or multiple days) starts blank — there's no single
    // "current" value to show when applying one shift across several days at once.
    if (next.length === 1) {
      const existing = scheduleByDay[next[0]!];
      if (existing) {
        applyTimeInputsFromShift(existing);
      } else {
        clearTimeInputs();
      }
    } else {
      clearTimeInputs();
    }
  };

  // "+ Add Hours": applies the entered Start/End shift to every currently selected weekday,
  // replacing each one's previous shift (never creating a duplicate entry — scheduleByDay is
  // keyed by day, so setting a key always replaces it).
  const handleAddHours = () => {
    setScheduleFieldError("");

    if (selectedDays.length === 0) {
      setScheduleFieldError("Select at least one day first");
      return;
    }

    const result = parseDraftShift();
    if (result.kind === "empty") {
      setScheduleFieldError("Enter a start and end shift time");
      return;
    }
    if (result.kind === "error") {
      setScheduleFieldError(result.message);
      return;
    }

    setScheduleByDay((prev) => {
      const next = { ...prev };
      for (const day of selectedDays) {
        next[day] = result.shift;
      }
      return next;
    });
    // Applied — clear the batch selection so the next click starts a fresh, deliberate
    // selection rather than silently continuing to target the same days.
    setSelectedDays([]);
    clearTimeInputs();
  };

  // Explicitly turns off every currently selected weekday that has a configured shift —
  // the clear, deliberate way to remove a working day, distinct from merely deselecting it.
  const handleRemoveSelectedDaysHours = () => {
    setScheduleFieldError("");
    setScheduleByDay((prev) => {
      const next = { ...prev };
      for (const day of selectedDays) {
        delete next[day];
      }
      return next;
    });
    setSelectedDays([]);
    clearTimeInputs();
  };

  const scheduleSelectionCaption = (): string => {
    if (selectedDays.length === 0) {
      return "Tap one or more days to set their hours";
    }
    if (selectedDays.length === 1) {
      const day = selectedDays[0]!;
      const shift = scheduleByDay[day];
      return shift
        ? `${dayShortLabel[day]}: ${formatTime12Hour(shift.startTime)} – ${formatTime12Hour(shift.endTime)}`
        : `${dayShortLabel[day]}: not set — enter hours and click + Add Hours`;
    }
    const orderedSelected = dayOrder.filter((day) => selectedDays.includes(day));
    return `${orderedSelected.map((day) => dayShortLabel[day]).join(", ")} selected — enter hours and click + Add Hours to apply to all`;
  };

  const canRemoveSelectedDaysHours = selectedDays.some((day) => scheduleByDay[day]);

  const loadEditableStaffState = (member: StaffMember) => {
    setStaffName(member.name);
    setStaffEmail(member.email || "");
    setStaffRole(member.role === "SUPERVISOR" ? "SUPERVISOR" : "STAFF");
    setStaffPhone(member.phone ? `${member.phone.countryCode} ${member.phone.nationalNumber}` : "");
    setStaffEmploymentActive(member.employmentActive);
    setPhotoPreview((prev) => {
      revokeIfBlob(prev);
      return member.avatarUrl ?? null;
    });
    setPendingAvatarFile(null);
    setPhotoError("");
    revokeIfBlob(cropSource);
    setCropSource(null);
    setCropBaseName(undefined);

    const nextSchedule: DayScheduleState = {};
    for (const day of member.schedule) {
      nextSchedule[day.dayOfWeek] = { startTime: day.startTime, endTime: day.endTime };
    }
    setScheduleByDay(nextSchedule);
    // No day is pre-selected as a batch-edit target — the chips accurately show which days
    // are already configured (via color), and the owner chooses which one(s) to edit next.
    setSelectedDays([]);
    clearTimeInputs();

    setTimeOffEntries(member.timeOff);
    setNewLeaveType("ANNUAL_HOLIDAY");
    setNewLeaveDate("2026-06-02");
    setNewLeaveEndDate("");
  };

  // The card's status toggle no longer mutates directly — it opens the two-step
  // deactivate / reactivate confirmation. Only the final "Confirm" there calls the API.
  const requestStatusChange = (id: number | string) => {
    const member = staffMembers.find((m) => (m.membershipId ?? m.userId) === id);
    if (!member || member.isOwner || !member.membershipId || !effectiveBusinessId) return;
    setActionError("");
    setAccessChangeError("");
    setAccessChange({
      mode: member.employmentActive ? "deactivate" : "reactivate",
      member,
    });
  };

  const requestRoleChange = (id: number | string) => {
    const member = staffMembers.find((m) => (m.membershipId ?? m.userId) === id);
    if (!member || member.isOwner || !member.membershipId || !effectiveBusinessId) return;
    setActionError("");
    setAccessChangeError("");
    setAccessChange({ mode: "role", member });
  };

  const closeAccessChange = () => {
    if (updateStaffMutation.isPending) return;
    setAccessChange(null);
    setAccessChangeError("");
  };

  const confirmAccessChange = async (newRole?: StaffCreatableRole) => {
    if (updateStaffMutation.isPending) return;
    if (!accessChange || !effectiveBusinessId || !accessChange.member.membershipId) return;
    const { mode, member } = accessChange;
    const input =
      mode === "role"
        ? { role: newRole }
        : { employmentActive: mode === "reactivate" };
    if (mode === "role" && (!newRole || newRole === member.role)) {
      setAccessChange(null);
      return;
    }
    setAccessChangeError("");
    try {
      await updateStaffMutation.mutateAsync({
        businessId: effectiveBusinessId,
        staffId: String(member.membershipId),
        input,
      });
      setAccessChange(null);
    } catch (error) {
      setAccessChangeError(toUserMessage(error));
    }
  };

  const handleEditStaff = (id: number | string) => {
    const member = staffMembers.find((m) => (m.membershipId ?? m.userId) === id);
    if (member && !member.isOwner) {
      loadEditableStaffState(member);
      setEditingStaffId(member.membershipId);
      setFormError("");
      setIsAdding(true);
    }
  };

  const closeForm = () => {
    setStaffName("");
    setStaffEmail("");
    setStaffPhone("");
    setStaffEmploymentActive(true);
    setEditingStaffId(null);
    revokeIfBlob(photoPreview);
    setPhotoPreview(null);
    setPendingAvatarFile(null);
    revokeIfBlob(cropSource);
    setCropSource(null);
    setCropBaseName(undefined);
    setPhotoError("");
    setFormError("");
    resetScheduleForm();
    resetTimeOffForm();
    setIsAdding(false);
  };

  // Called from the hidden <input type="file">. A valid pick opens the crop modal; it does
  // NOT stage anything yet. An invalid pick shows an inline message and changes nothing.
  const handlePhotoFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Allow re-picking the same file later (onChange won't fire otherwise).
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED_AVATAR_TYPES.includes(file.type) || file.size > MAX_AVATAR_BYTES) {
      setPhotoError(AVATAR_REJECT_MESSAGE);
      return;
    }

    setPhotoError("");
    revokeIfBlob(cropSource);
    setCropSource(URL.createObjectURL(file));
    setCropBaseName(file.name);
  };

  const closeCrop = () => {
    revokeIfBlob(cropSource);
    setCropSource(null);
    setCropBaseName(undefined);
  };

  // The crop modal handed back a square JPEG File. Stage it exactly the way the old direct
  // pick used to — the real upload still happens on Save changes (handleAddStaff).
  const handleCroppedAvatar = (file: File) => {
    setPhotoPreview((prev) => {
      revokeIfBlob(prev);
      return URL.createObjectURL(file);
    });
    setPendingAvatarFile(file);
    setPhotoError("");
    revokeIfBlob(cropSource);
    setCropSource(null);
    setCropBaseName(undefined);
  };

  // Revoke any object URLs still held when the component unmounts.
  useEffect(
    () => () => {
      revokeIfBlob(photoPreview);
      revokeIfBlob(cropSource);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleDeleteStaff = async () => {
    if (editingStaffId === null || !effectiveBusinessId) return;
    setIsSubmitting(true);
    setFormError("");
    try {
      await removeStaffMutation.mutateAsync({ businessId: effectiveBusinessId, staffId: editingStaffId });
      closeForm();
    } catch (error) {
      setFormError(toUserMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddStaff = async () => {
    if (!staffName || !staffEmail || !effectiveBusinessId) return;

    // Save changes must not silently discard a valid Start/End draft the user typed but
    // never explicitly applied via "+ Add Hours" (STEP 2), and must not persist a partial/
    // invalid draft either (STEP 3). `effectiveSchedule` is a local variable — computed once
    // here and used directly below — rather than something read back from React state after
    // setScheduleByDay, which could still observe the pre-update value (STEP 10).
    setScheduleFieldError("");
    const { schedule: effectiveSchedule, blockingError } = resolveScheduleForSave();
    if (blockingError) {
      setScheduleFieldError(blockingError);
      return;
    }

    setScheduleByDay(effectiveSchedule);
    setSelectedDays([]);
    clearTimeInputs();

    setIsSubmitting(true);
    setFormError("");

    const scheduleDays: ScheduleDay[] = Object.entries(effectiveSchedule)
      .filter((entry): entry is [DayOfWeek, { startTime: string; endTime: string }] => Boolean(entry[1]))
      .map(([dayOfWeek, hours]) => ({ dayOfWeek, startTime: hours.startTime, endTime: hours.endTime }));

    try {
      // Phase 2D — Create Mode issues an invitation; no User/membership exists yet, so schedule
      // and photo can't be attached now. The owner sets those from Edit once the person accepts.
      if (editingStaffId === null) {
        await createStaffMutation.mutateAsync({
          businessId: effectiveBusinessId,
          input: {
            name: staffName,
            email: staffEmail,
            role: staffRole,
            phone: staffPhone || undefined,
          },
        });
        closeForm();
        setIsSubmitting(false);
        return;
      }

      // Edit Mode only (Create returned early above). Business is intentionally not sent: a
      // Staff membership cannot be transferred between businesses in this phase.
      //
      // `role` is intentionally EXCLUDED from this payload. STAFF <-> SUPERVISOR changes go ONLY
      // through the dedicated two-step StaffAccessChangeModal ("Change role" action below).
      await updateStaffMutation.mutateAsync({
        businessId: effectiveBusinessId,
        staffId: editingStaffId,
        input: {
          name: staffName,
          email: staffEmail,
          phone: staffPhone || undefined,
          employmentActive: staffEmploymentActive
        }
      });
      const targetStaffId: string = editingStaffId;

      if (scheduleDays.length > 0 || editingStaffId !== null) {
        try {
          await putScheduleMutation.mutateAsync({
            businessId: effectiveBusinessId,
            staffId: targetStaffId,
            input: { days: scheduleDays }
          });
        } catch (scheduleError) {
          setFormError(
            `Staff details saved, but the schedule could not be saved: ${toUserMessage(scheduleError)}`
          );
          setIsSubmitting(false);
          return;
        }
      }

      if (pendingAvatarFile) {
        try {
          await uploadAvatarMutation.mutateAsync({
            businessId: effectiveBusinessId,
            staffId: targetStaffId,
            file: pendingAvatarFile
          });
        } catch (avatarError) {
          setFormError(
            editingStaffId !== null
              ? `Staff details saved, but the photo could not be saved: ${toUserMessage(avatarError)}`
              : `Staff member created, but the photo could not be saved: ${toUserMessage(avatarError)}. You can retry from Edit.`
          );
          setIsSubmitting(false);
          return;
        }
      }

      closeForm();
    } catch (error) {
      setFormError(toUserMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTimeOff = async () => {
    if (editingStaffId === null || !effectiveBusinessId) return;
    setTimeOffError("");
    try {
      const created = await createTimeOffMutation.mutateAsync({
        businessId: effectiveBusinessId,
        staffId: editingStaffId,
        input: {
          type: newLeaveType,
          startDate: newLeaveDate,
          endDate: newLeaveEndDate || undefined
        }
      });
      setTimeOffEntries((prev) => [...prev, created]);
      setNewLeaveEndDate("");
    } catch (error) {
      setTimeOffError(toUserMessage(error));
    }
  };

  const handleRemoveTimeOff = async (timeOffId: string) => {
    if (editingStaffId === null || !effectiveBusinessId) return;
    setTimeOffError("");
    setTimeOffBusyId(timeOffId);
    try {
      await removeTimeOffMutation.mutateAsync({
        businessId: effectiveBusinessId,
        staffId: editingStaffId,
        timeOffId
      });
      setTimeOffEntries((prev) => prev.filter((entry) => entry.id !== timeOffId));
    } catch (error) {
      setTimeOffError(toUserMessage(error));
    } finally {
      setTimeOffBusyId(null);
    }
  };

  // Rendered in BOTH the list view and the edit-staff view so the "Change role" action works
  // from either entry point. It is a no-op overlay while `accessChange` is null.
  const accessChangeModal = (
    <StaffAccessChangeModal
      key={accessChange ? `${accessChange.mode}:${accessChange.member.membershipId}` : "closed"}
      mode={accessChange?.mode ?? null}
      staffName={accessChange?.member.name ?? ""}
      businessName={businessProfileQuery.data?.primary?.name ?? "your business"}
      currentRole={accessChange?.member.role === "SUPERVISOR" ? "SUPERVISOR" : "STAFF"}
      currentStatus={accessChange?.member.employmentActive ? "Active" : "Inactive"}
      pending={updateStaffMutation.isPending}
      errorMessage={accessChangeError}
      onClose={closeAccessChange}
      onConfirm={confirmAccessChange}
    />
  );

  if (isAdding) {
    return (
      <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] md: select-none font-poppins relative">
        {/* Header Row */}
        <DashboardHeader title={editingStaffId !== null ? "Edit staff" : "Add staff"} subtitle={editingStaffId !== null ? "Edit staff info" : "Add new staff to your team"} />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">

        {/* Breadcrumbs */}
        <div className="flex flex-row items-center gap-3 mb-[40px] select-none w-full">
          <button
            type="button"
            onClick={closeForm}
            className="w-4 h-4 flex items-center justify-center text-[#888780] hover:text-black cursor-pointer"
          >
            <HugeiconsIcon icon={ArrowLeft02Icon} className="w-4 h-4" />
          </button>

          <div className="flex flex-row items-center gap-2 text-[13px] font-medium text-[#888780]">
            <button
              type="button"
              onClick={closeForm}
              className="hover:text-black cursor-pointer"
            >
              <span>Staff</span>
            </button>
            <span>&gt;</span>
            <span className="text-[#1C1C1A] font-semibold">
              {editingStaffId !== null ? "Edit staff" : "Add staff"}
            </span>
          </div>
        </div>

        {/* Form Container (No wrapper white card, aligned under 'Add staff') */}
        <div className="ml-0 md:ml-[100px] flex flex-col gap-[20px] w-full max-w-full md:max-w-[958.4px]">

          {/* Photo Section */}
          <div className="flex flex-col gap-[12px] w-full">
            <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
              photo
            </span>
            <div className="relative w-[80px] h-[80px]">
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                accept={ACCEPTED_AVATAR_TYPES.join(",")}
                className="hidden"
                onChange={handlePhotoFileSelected}
              />
              {/* Mouse affordance only — keyboard users reach the labelled camera button below,
                  which is the single tab stop (matches the pre-existing behaviour). */}
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                disabled={avatarUploadPending || isSubmitting}
                onClick={() => fileInputRef.current?.click()}
                className="w-[80px] h-[80px] rounded-full bg-[#E1E0E6] flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity disabled:cursor-not-allowed"
              >
                <Image src={photoPreview || "/img/dumyUser.jpeg"} alt="Avatar Preview" className="w-full h-full object-cover" fill />
              </button>
              {avatarUploadPending && (
                <div className="absolute inset-0 rounded-full bg-black/45 flex items-center justify-center">
                  <Spinner className="size-5 text-white" />
                  <span className="sr-only" role="status" aria-live="polite">
                    Uploading photo…
                  </span>
                </div>
              )}
              <button
                type="button"
                aria-label="Change staff photo"
                disabled={avatarUploadPending || isSubmitting}
                onClick={() => fileInputRef.current?.click()}
                className="absolute right-0 bottom-0 w-[32px] h-[32px] bg-white border border-[#C6C6CB] rounded-full flex items-center justify-center shadow-sm cursor-pointer hover:bg-neutral-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                <HugeiconsIcon icon={Camera01Icon} className="w-4 h-4 text-[#141B34]" />
              </button>
            </div>
            {photoError && (
              <div className="w-full px-3 py-2 rounded-[8px] bg-[#FFF5F5] border border-[#FCDDEC] text-[#DE350B] text-[12px] font-poppins font-medium">
                {photoError}
              </div>
            )}
          </div>

          {/* Name Field */}
          <div className="flex flex-col gap-[12px] w-full">
            <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
              name
            </span>
            <input
              type="text"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Hohb doe"
              className="h-[44px] w-full bg-white border border-[#C6C6CB] rounded-[8px] px-4 font-poppins text-sm text-[#1C1B1C] placeholder:text-[#5F5E5A] focus:outline-none shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
            />
          </div>

          {/* Email and Role Row */}
          <div className="flex flex-col md:flex-row gap-[20px] w-full">
            {/* Email */}
            <div className="flex-1 flex flex-col gap-[12px]">
              <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                email
              </span>
              <input
                type="email"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="Eslsj@gam.com"
                className="h-[44px] w-full bg-white border border-[#C6C6CB] rounded-[8px] px-4 font-poppins text-sm text-[#1C1B1C] placeholder:text-[#5F5E5A] focus:outline-none shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
              />
            </div>

            {/* Role */}
            <div className="flex-1 flex flex-col gap-[12px]">
              <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                role
              </span>
              {editingStaffId !== null ? (
                // Edit Mode — role is DISPLAY-ONLY here. STAFF <-> SUPERVISOR changes go only
                // through the dedicated two-step confirmation modal (same one the StaffCard
                // role badge opens), never through this form's Save Changes.
                <div className="flex items-center gap-3 w-full">
                  <div className="h-[44px] flex-1 flex items-center bg-[#F5F5F5] border border-[#C6C6CB] rounded-[8px] px-4 font-poppins text-sm text-[#1C1B1C]">
                    {displayRole((editingMember?.role ?? staffRole) as StaffMember["role"])}
                  </div>
                  <button
                    type="button"
                    disabled={!editingMember}
                    onClick={() => {
                      if (editingMember) {
                        setActionError("");
                        setAccessChangeError("");
                        setAccessChange({ mode: "role", member: editingMember });
                      }
                    }}
                    className="h-[44px] px-4 shrink-0 bg-[#1C1B1C] hover:bg-black text-white font-poppins font-medium text-xs rounded-[8px] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Change role
                  </button>
                </div>
              ) : (
                <div className="relative w-full">
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value as StaffCreatableRole)}
                    className="appearance-none h-[44px] w-full bg-white border border-[#C6C6CB] rounded-[8px] px-4 font-poppins text-sm text-[#1C1B1C] focus:outline-none shadow-[0px_1px_2px_rgba(0,0,0,0.05)] pr-10 cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23141B34' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 16px center',
                      backgroundSize: '16px'
                    }}
                  >
                    {/* Business Owner is intentionally not a selectable option here — a
                        Business Owner may only create SUPERVISOR/STAFF accounts (enforced
                        server-side too, see api/src/modules/staff/staff.schema.ts). */}
                    <option value="SUPERVISOR">Supervisor</option>
                    <option value="STAFF">Staff</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Phone Field */}
          <div className="flex flex-col gap-[12px] w-full">
            <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
              phone
            </span>
            <input
              type="text"
              value={staffPhone}
              onChange={(e) => setStaffPhone(e.target.value)}
              placeholder="+357 99 111222"
              className="h-[44px] w-full bg-white border border-[#C6C6CB] rounded-[8px] px-4 font-poppins text-sm text-[#1C1B1C] placeholder:text-[#5F5E5A] focus:outline-none shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
            />
          </div>

          {/* Services Field */}
          <div className="flex flex-col gap-[12px] w-full">
            <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
              services
            </span>
            <div className="relative w-full">
              <select
                disabled
                title="Services assignment is coming in a later update"
                className="appearance-none h-[44px] w-full bg-white border border-[#C6C6CB] rounded-[8px] px-4 font-poppins text-sm text-[#1C1B1C] focus:outline-none shadow-[0px_1px_2px_rgba(0,0,0,0.05)] pr-10 cursor-not-allowed opacity-70"
                style={{
                  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23141B34' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 16px center',
                  backgroundSize: '16px'
                }}
              >
                <option value="assigned_services">Assigned services</option>
              </select>
            </div>
          </div>

          {/* Working Hours & Leave Section Grid */}
          <div className="flex flex-col md:flex-row gap-[48px] w-full items-start mt-4">

            {/* Business Working Hours Column */}
            <div className="flex-1 flex flex-col gap-[12px] w-full max-w-full md:max-w-[455.2px]">
              <span className="font-poppins font-medium text-sm leading-[22px] text-[#101828]">
                Edit Business Working Hours
              </span>
              <div className="box-sizing-border-box flex flex-col items-start p-6 bg-white border border-[#E5E7EB] rounded-[4px] w-full h-auto min-h-[272px] justify-between gap-4">
                <div className="flex flex-row justify-between w-full px-2 gap-1 overflow-x-auto scrollbar-hide">
                  {dayOrder.map((day) => {
                    const configured = Boolean(scheduleByDay[day]);
                    const selected = selectedDays.includes(day);
                    return (
                      <div key={day} className="flex flex-col items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleDaySelection(day)}
                          className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer text-xs ${
                            configured
                              ? "bg-[#E1F5EE] border-[#0F6E56]/40 text-[#0F6E56]"
                              : "bg-white border-[#D1D5DC] text-neutral-500"
                          } ${selected ? "ring-2 ring-[#2E9DA7] ring-offset-1" : ""}`}
                        >
                          {dayShortLabel[day][0]}
                        </button>
                        <span
                          onClick={() => toggleDaySelection(day)}
                          className="font-poppins font-medium text-[14px] leading-[20px] text-[#101828] cursor-pointer"
                        >
                          {dayShortLabel[day]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="w-full border-t border-[#F3F4F6] my-2" />

                <div className="flex flex-row justify-between gap-4 w-full">
                  {/* Start shift */}
                  <div className="flex-1 flex flex-col gap-2">
                    <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                      start shift
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="9:00"
                        value={startTimeText}
                        onChange={(e) => setStartTimeText(sanitizeTimeDraftInput(e.target.value))}
                        disabled={selectedDays.length === 0}
                        maxLength={5}
                        inputMode="numeric"
                        className="h-[41.6px] bg-white border border-[#C6C6CB] rounded-[8px] px-3 font-poppins text-base text-[#364153] focus:outline-none shadow-[0px_1px_2px_rgba(0,0,0,0.05)] w-full disabled:opacity-50"
                      />
                      <div className="flex bg-neutral-100 rounded-lg p-0.5 select-none h-8 items-center shrink-0">
                        <button type="button" onClick={() => setPeriodInput("AM")} disabled={selectedDays.length === 0} className={`px-2 h-7 rounded-md text-[10px] font-semibold transition-all ${periodInput === "AM" ? "bg-white text-black shadow-sm" : "text-neutral-500"}`}>AM</button>
                        <button type="button" onClick={() => setPeriodInput("PM")} disabled={selectedDays.length === 0} className={`px-2 h-7 rounded-md text-[10px] font-semibold transition-all ${periodInput === "PM" ? "bg-white text-black shadow-sm" : "text-neutral-500"}`}>PM</button>
                      </div>
                    </div>
                  </div>
                  {/* End shift */}
                  <div className="flex-1 flex flex-col gap-2">
                    <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                      end shift
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="5:00"
                        value={endTimeText}
                        onChange={(e) => setEndTimeText(sanitizeTimeDraftInput(e.target.value))}
                        disabled={selectedDays.length === 0}
                        maxLength={5}
                        inputMode="numeric"
                        className="h-[41.6px] bg-white border border-[#C6C6CB] rounded-[8px] px-3 font-poppins text-base text-[#364153] focus:outline-none shadow-[0px_1px_2px_rgba(0,0,0,0.05)] w-full disabled:opacity-50"
                      />
                      <div className="flex bg-neutral-100 rounded-lg p-0.5 select-none h-8 items-center shrink-0">
                        <button type="button" onClick={() => setEndPeriodInput("AM")} disabled={selectedDays.length === 0} className={`px-2 h-7 rounded-md text-[10px] font-semibold transition-all ${endPeriodInput === "AM" ? "bg-white text-black shadow-sm" : "text-neutral-500"}`}>AM</button>
                        <button type="button" onClick={() => setEndPeriodInput("PM")} disabled={selectedDays.length === 0} className={`px-2 h-7 rounded-md text-[10px] font-semibold transition-all ${endPeriodInput === "PM" ? "bg-white text-black shadow-sm" : "text-neutral-500"}`}>PM</button>
                      </div>
                    </div>
                  </div>
                </div>

                {scheduleFieldError && (
                  <span className="text-[11px] text-[#DE350B] font-poppins">{scheduleFieldError}</span>
                )}

                <span className="text-[11px] text-[#888780] font-poppins">
                  {scheduleSelectionCaption()}
                </span>

                <div className="flex flex-row items-center gap-4 mt-2">
                  <button
                    type="button"
                    onClick={handleAddHours}
                    disabled={selectedDays.length === 0}
                    className="flex items-center gap-1.5 text-[#2E9DA7] hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="text-[17px] leading-[17px] font-bold">+</span>
                    <span className="font-poppins font-medium text-sm leading-[20px]">Add Hours</span>
                  </button>

                  {canRemoveSelectedDaysHours && (
                    <button
                      type="button"
                      onClick={handleRemoveSelectedDaysHours}
                      className="font-poppins font-medium text-sm leading-[20px] text-[#888780] hover:text-[#DE350B] transition-opacity cursor-pointer"
                    >
                      Remove hours
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Leave Reason & Date Column */}
            <div className="flex-1 flex flex-col gap-[12px] w-full max-w-full md:max-w-[455.2px]">
              <span className="font-poppins font-medium text-sm leading-[22px] text-[#101828]">
                Leave reason & date
              </span>

              {editingStaffId === null ? (
                <div className="text-xs text-[#888780] font-poppins bg-[#FAFAF9] border border-[#E8E8E4]/60 rounded-lg p-3">
                  Save the staff member first to add time off.
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row justify-between gap-4 w-full">
                    {/* Reason */}
                    <div className="flex-1 w-full flex flex-col gap-2">
                      <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                        name
                      </span>
                      <div className="relative w-full">
                        <select
                          value={newLeaveType}
                          onChange={(e) => setNewLeaveType(e.target.value as StaffTimeOffType)}
                          className="appearance-none h-[41.6px] bg-white border border-[#C6C6CB] rounded-[8px] px-3 font-poppins text-sm text-[#111111] focus:outline-none pr-10 cursor-pointer w-full"
                          style={{
                            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23141B34' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 12px center',
                            backgroundSize: '16px'
                          }}
                        >
                          <option value="ANNUAL_HOLIDAY">{timeOffTypeLabels.ANNUAL_HOLIDAY}</option>
                          <option value="SICK_LEAVE">{timeOffTypeLabels.SICK_LEAVE}</option>
                        </select>
                      </div>
                    </div>

                    {/* Date */}
                    <div className="flex-1 w-full flex flex-col gap-2">
                      <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                        date
                      </span>
                      <input
                        type="date"
                        value={newLeaveDate}
                        onChange={(e) => setNewLeaveDate(e.target.value)}
                        className="h-[41.6px] bg-white border border-[#C6C6CB] rounded-[8px] px-3 font-poppins text-sm text-[#111111] focus:outline-none w-full"
                      />
                    </div>

                    {/* End date (optional) — empty = single day, populated = inclusive range */}
                    <div className="flex-1 w-full flex flex-col gap-2">
                      <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                        end date (optional)
                      </span>
                      <input
                        type="date"
                        value={newLeaveEndDate}
                        onChange={(e) => setNewLeaveEndDate(e.target.value)}
                        min={newLeaveDate}
                        className="h-[41.6px] bg-white border border-[#C6C6CB] rounded-[8px] px-3 font-poppins text-sm text-[#111111] focus:outline-none w-full"
                      />
                    </div>
                  </div>

                  {timeOffError && (
                    <span className="text-[11px] text-[#DE350B] font-poppins">{timeOffError}</span>
                  )}

                  {/* Add Holidays action */}
                  <button
                    type="button"
                    onClick={handleAddTimeOff}
                    disabled={createTimeOffMutation.isPending}
                    className="flex items-center gap-1.5 text-[#2E9DA7] hover:opacity-80 transition-opacity cursor-pointer mt-2 w-fit disabled:opacity-50"
                  >
                    <span className="text-[17px] leading-[17px] font-bold">+</span>
                    <span className="font-poppins font-medium text-sm leading-[20px]">Add Holidays</span>
                  </button>

                  {/* Leaves list with removes */}
                  {timeOffEntries.length > 0 && (
                    <div className="flex flex-col gap-3 mt-4 w-full">
                      {timeOffEntries.map((leave) => (
                        <div key={leave.id} className="flex flex-col sm:flex-row justify-between gap-4 w-full items-start sm:items-end border border-neutral-100 p-3 rounded-lg sm:border-0 sm:p-0">
                          <div className="flex-1 w-full flex flex-col gap-2">
                            <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                              name
                            </span>
                            <div className="h-[41.6px] bg-white border border-[#C6C6CB] rounded-[8px] px-3 font-poppins text-sm text-[#111111] flex items-center w-full">
                              {timeOffTypeLabels[leave.type]}
                            </div>
                          </div>
                          <div className="flex-1 w-full flex flex-col gap-2">
                            <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                              date
                            </span>
                            <div className="h-[41.6px] bg-white border border-[#C6C6CB] rounded-[8px] px-3 font-poppins text-sm text-[#111111] flex items-center w-full">
                              {formatTimeOffRange(leave)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveTimeOff(leave.id)}
                            disabled={timeOffBusyId === leave.id}
                            className="w-full sm:w-auto h-[41.6px] sm:h-[32px] px-4 bg-gradient-to-b from-[rgba(12,192,223,0.2)] to-[rgba(12,192,223,0.2)] bg-[#8EBAC5] rounded hover:opacity-90 transition-opacity text-sm font-medium text-[#111111] cursor-pointer flex items-center justify-center font-poppins shrink-0 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Form error */}
          {formError && (
            <div className="w-full px-4 py-3 rounded-[8px] bg-[#FFF5F5] border border-[#FCDDEC] text-[#DE350B] text-xs font-poppins font-medium">
              {formError}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-row justify-end items-center gap-[12px] w-full h-[34px] mt-6">
            {editingStaffId !== null && (
              <button
                type="button"
                onClick={handleDeleteStaff}
                disabled={isSubmitting}
                className="h-[34px] px-4 bg-[#FCDDEC] text-[#DE350B] font-poppins font-medium text-xs rounded-[8px] hover:bg-[#FBCFE8] transition-colors cursor-pointer flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={closeForm}
              disabled={isSubmitting}
              className="h-[34px] px-4 bg-[#EBEBEB] text-[#757575] font-poppins font-medium text-xs rounded-[8px] hover:bg-[#E2E2E2] transition-colors cursor-pointer flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddStaff}
              disabled={isSubmitting}
              className="h-[34px] px-4 bg-[#1C1B1C] hover:bg-black text-white font-poppins font-medium text-xs rounded-[8px] transition-colors cursor-pointer flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : "Save changes"}
            </button>
          </div>

        </div>

      </div>
      {accessChangeModal}
      <StaffPhotoCropModal
        key={cropSource ?? "closed"}
        open={cropSource !== null}
        imageSrc={cropSource}
        baseName={cropBaseName}
        onCancel={closeCrop}
        onConfirm={handleCroppedAvatar}
      />
      </main>
    );
  }

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] md: select-none font-poppins relative">
      {/* Header Row */}
      <DashboardHeader title="Staff" subtitle="Team members, hours, and service assignments" />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">

      {/* Control row: Stats pill & Add Staff button */}
      <div className="flex flex-wrap justify-between items-center w-full mb-5 gap-4">
        {/* Active / Draft Stats pill */}
        <div className="bg-white border border-[#F5F5F4] rounded-full py-2 px-4 shadow-sm flex items-center gap-2.5 text-sm font-medium">
          <span className="w-1.5 h-1.5 bg-[#1D9E75] rounded-full" />
          <span className="text-[#1F8900]">{staffMembers.length} staff members</span>
          <span className="text-neutral-300">•</span>
          <span className="text-[#79716B]">each with their own calendar</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Add Staff Member button */}
          <button
            onClick={() => setIsAdding(true)}
            className="bg-[#111111] hover:bg-black text-white text-[13px] font-medium px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow transition-all cursor-pointer"
          >
            <HugeiconsIcon icon={PlusIcon} className="w-3.5 h-3.5" />
            <span>Add Staff member</span>
          </button>
        </div>
      </div>

      {/* Load error */}
      {loadError && (
        <div className="w-full px-4 py-3 rounded-xl bg-[#FFF5F5] border border-[#FCDDEC] text-[#DE350B] text-xs font-poppins font-medium mb-5">
          {loadError}
        </div>
      )}

      {/* Staff Cards Grid */}
      {isLoading ? (
        <div className="w-full py-10 text-center text-sm text-[#79716B] font-poppins mb-8">Loading staff…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full mb-8">
          {displayStaffMembers.map((staff) => (
            <StaffCard
              key={staff.id}
              staff={staff}
              onToggleStatus={requestStatusChange}
              onEdit={handleEditStaff}
              onChangeRole={requestRoleChange}
              canEdit={staff.role !== "Owner"}
            />
          ))}
        </div>
      )}

      {/* Pending invitations (Phase 2D) */}
      {pendingInvitations.length > 0 && (
        <div className="w-full mb-6">
          <h3 className="text-sm font-semibold text-[#1A1A1A] font-poppins mb-3">
            Pending invitations
          </h3>
          <div className="flex flex-col gap-2">
            {pendingInvitations.map((invitation) => {
              const busy =
                (resendInvitationMutation.isPending &&
                  resendInvitationMutation.variables?.invitationId === invitation.invitationId) ||
                (revokeInvitationMutation.isPending &&
                  revokeInvitationMutation.variables?.invitationId === invitation.invitationId);
              return (
                <div
                  key={invitation.invitationId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E8E8E4]/70 bg-[#FAFAF9] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1A1A1A] font-poppins truncate">
                      {invitation.email}
                    </p>
                    <p className="text-xs text-[#79716B] font-poppins">
                      {invitation.role === "SUPERVISOR" ? "Supervisor" : "Staff"} · invitation sent ·
                      awaiting acceptance
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        resendInvitationMutation.mutate({
                          businessId: effectiveBusinessId,
                          invitationId: invitation.invitationId,
                        })
                      }
                      className="text-xs font-semibold text-[#240183] hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      Resend
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        revokeInvitationMutation.mutate({
                          businessId: effectiveBusinessId,
                          invitationId: invitation.invitationId,
                        })
                      }
                      className="text-xs font-semibold text-[#DE350B] hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info Alert Box */}
      <div className="bg-[#FAFAF9] border border-[#E8E8E4]/60 rounded-xl p-4 flex items-center gap-3 w-full mb-6">
        <HugeiconsIcon icon={InformationCircleIcon} className="w-5 h-5 text-[#888780] shrink-0" />
        <span className="text-xs text-[#757575] font-poppins">An invitation link is emailed to Supervisors and Staff when they&apos;re added — their account is created once they accept it and set a password or continue with Google.</span>
      </div>

      {/* Staff Availability Table */}
      <StaffAvailabilityTable rows={availabilityRows} />

      {/* Role Permissions Section */}
      <StaffRolePermissions />

      </div>

      {accessChangeModal}
      </main>
  );
}

/** Canonical "HH:mm" -> {hour: 1-12, minute, period}, for prefilling the 12-hour inputs. */
function parseTime12HourInputFromCanonical(hhmm: string): { hour: number; minute: number; period: "AM" | "PM" } {
  const label = formatTime12Hour(hhmm);
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(label);
  if (!match) return { hour: 9, minute: 0, period: "AM" };
  return { hour: Number(match[1]), minute: Number(match[2]), period: match[3] as "AM" | "PM" };
}
