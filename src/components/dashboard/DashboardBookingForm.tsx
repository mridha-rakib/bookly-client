"use client";
import Image from "next/image";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft02Icon,
  Search01Icon,
  ArrowDown01Icon,
  Calendar03Icon,
  Clock01Icon,
  Cancel01Icon,
  UserCircle02Icon,
  Note02Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";

import { useServicesQuery } from "@/lib/services/hooks";
import { useAddonsForServiceQuery } from "@/lib/addons/hooks";
import { useClientsQuery, useCreateClientMutation } from "@/lib/clients/hooks";
import { clientInputSchema, flattenClientErrors } from "@/lib/clients/schema";
import type { BusinessClientDto, CreateClientInput } from "@/lib/api/clients";
import { CLIENT_TAGS, type ClientTag } from "@/lib/api/clients";
import { useCreateManualBookingMutation } from "@/lib/bookings/hooks";
import { usePublicBookingConfigQuery } from "@/lib/superAdminSettings/hooks";
import type { CreateManualBookingInput } from "@/lib/api/bookings";
import { useAvailabilityQuery } from "@/lib/availability/hooks";
import type { AvailabilitySlot } from "@/lib/api/availability";
import type { Service } from "@/lib/api/services";
import { formatEuro, formatServiceDuration, formatServicePrice } from "@/lib/services/format";
import { BUSINESS_CITIES, type BusinessCity } from "@/lib/constants/cities";
import { CLIENT_PROPERTY_TYPES } from "@/lib/api/clients";
import { getFieldErrors, toUserMessage } from "@/lib/auth/messages";
import TimeStep from "@/app/venue/components/TimeStep";

interface DashboardBookingFormProps {
  businessId: string;
  /** Determines whether this booking needs a travel address at all — derived from the
   * Business's own fixed configuration (see BookingCreationService.resolveFulfilment), never
   * chosen per-booking. */
  visitType: "AT_BUSINESS_LOCATION" | "TRAVEL_TO_CUSTOMER" | undefined;
  onClose: () => void;
  onCreated: (bookingId: string) => void;
}

type PricingInput = { hours?: number; personCount?: number };

const emptyAddress = {
  city: "" as BusinessCity | "",
  propertyType: "" as (typeof CLIENT_PROPERTY_TYPES)[number] | "",
  area: "",
  streetName: "",
  streetNumber: "",
  floorUnit: "",
  aptRoom: "",
  additionalDirections: "",
};

/** Batch 10 — real Business Owner/Supervisor manual booking creation. Reuses the exact same
 * shared primitives the real Customer booking flow (Batch 9) and Clients page already use —
 * never a second booking engine, never a second client-creation flow, never a second
 * availability engine. A MANUAL booking never charges anything online (server-enforced,
 * always depositCents=0/platformFeeCents=0 — see BookingService.validateManualBookingHasNoBooklyFee)
 * so there is deliberately no payment/deposit step anywhere in this form. */
export default function DashboardBookingForm({
  businessId,
  visitType,
  onClose,
  onCreated,
}: DashboardBookingFormProps) {
  const [isPhoneDropdownOpen, setIsPhoneDropdownOpen] = useState(false);

  // --- Client selection --------------------------------------------------------------------
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<BusinessClientDto | undefined>(undefined);
  const [isAddingNewClient, setIsAddingNewClient] = useState(false);

  const clientsQuery = useClientsQuery(
    businessId,
    { q: clientSearch, limit: 8, archived: false },
    clientSearch.trim().length > 0 && !selectedClient,
  );
  const createClientMutation = useCreateClientMutation();

  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newDob, setNewDob] = useState("");
  const [newGender, setNewGender] = useState<"male" | "female" | "other">("male");
  const [newEmail, setNewEmail] = useState("");
  const [newPhoneCode, setNewPhoneCode] = useState("+357");
  const [newPhone, setNewPhone] = useState("");
  const [newTag, setNewTag] = useState<ClientTag | "">("");
  const [newAddress, setNewAddress] = useState(emptyAddress);
  const [clientFormErrors, setClientFormErrors] = useState<Record<string, string>>({});

  // Appointment (travel) address for an EXISTING client at a TRAVEL_TO_CUSTOMER business —
  // never re-saved to the Client record, only sent as this booking's own travelAddress.
  const [travelAddress, setTravelAddress] = useState(emptyAddress);

  const requiresAddress = isAddingNewClient || visitType === "TRAVEL_TO_CUSTOMER";
  const addressState = isAddingNewClient ? newAddress : travelAddress;
  const setAddressField = (patch: Partial<typeof emptyAddress>) => {
    if (isAddingNewClient) {
      setNewAddress((prev) => ({ ...prev, ...patch }));
    } else {
      setTravelAddress((prev) => ({ ...prev, ...patch }));
    }
  };

  const selectClient = (client: BusinessClientDto) => {
    setSelectedClient(client);
    setIsAddingNewClient(false);
    setClientSearch("");
    setTravelAddress({
      city: client.address.city,
      propertyType: client.address.propertyType,
      area: client.address.area,
      streetName: client.address.streetName,
      streetNumber: client.address.streetNumber,
      floorUnit: client.address.floorUnit ?? "",
      aptRoom: client.address.aptRoom ?? "",
      additionalDirections: client.address.additionalDirections ?? "",
    });
  };

  const clearClient = () => {
    setSelectedClient(undefined);
    setIsAddingNewClient(false);
    setTravelAddress(emptyAddress);
  };

  // --- Services / add-ons -------------------------------------------------------------------
  const servicesQuery = useServicesQuery(businessId, { status: "ACTIVE" });
  // Package-deal services cannot be booked at all yet anywhere in this codebase — see
  // BookingCreationService.resolveServiceLines's own BOOKING_PACKAGE_SERVICE_NOT_SUPPORTED_YET —
  // excluded here rather than offered and then rejected at submit time.
  const bookableServices = (servicesQuery.data?.services ?? []).filter((s) => !s.isPackageDeal);

  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [pricingInputByService, setPricingInputByService] = useState<Record<string, PricingInput>>({});
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  const selectedServices = selectedServiceIds
    .map((id) => bookableServices.find((s) => s.id === id))
    .filter((s): s is Service => Boolean(s));
  const primaryServiceId = selectedServiceIds[0];

  const addonsQuery = useAddonsForServiceQuery(businessId, primaryServiceId);
  const activeAddons = (addonsQuery.data ?? []).filter((a) => a.status === "ACTIVE");

  // Server-authoritative product limit on service lines per booking (Batch 21). The backend
  // re-validates on create regardless; this only stops the UI going over.
  const bookingConfigQuery = usePublicBookingConfigQuery();
  const maxServicesPerBooking = bookingConfigQuery.data?.maxServicesPerBooking ?? 5;
  const atServiceLimit = selectedServiceIds.length >= maxServicesPerBooking;

  const addService = (serviceId: string) => {
    if (!serviceId || selectedServiceIds.includes(serviceId)) return;
    if (selectedServiceIds.length >= maxServicesPerBooking) return;
    const service = bookableServices.find((s) => s.id === serviceId);
    setSelectedServiceIds((prev) => [...prev, serviceId]);
    if (service?.pricingMode === "HOURLY" && service.hourlyPricing) {
      setPricingInputByService((prev) => ({ ...prev, [serviceId]: { hours: service.hourlyPricing!.minHours } }));
    } else if (service?.pricingMode === "PER_PERSON" && service.perPersonPricing) {
      setPricingInputByService((prev) => ({
        ...prev,
        [serviceId]: { personCount: service.perPersonPricing!.minPersons },
      }));
    }
  };

  const removeService = (serviceId: string) => {
    setSelectedServiceIds((prev) => prev.filter((id) => id !== serviceId));
    setPricingInputByService((prev) => {
      const next = { ...prev };
      delete next[serviceId];
      return next;
    });
    // Add-ons are always scoped to the FIRST selected service (see the section below) — removing
    // it invalidates any add-ons already picked against it.
    if (serviceId === primaryServiceId) {
      setSelectedAddonIds([]);
    }
  };

  const estimatePriceCents = (service: Service, input: PricingInput): number => {
    if (service.pricingMode === "FIXED" && service.fixedPricing) return service.fixedPricing.priceCents;
    if (service.pricingMode === "HOURLY" && service.hourlyPricing) {
      return (input.hours ?? service.hourlyPricing.minHours) * service.hourlyPricing.ratePerHourCents;
    }
    if (service.pricingMode === "PER_PERSON" && service.perPersonPricing) {
      return (input.personCount ?? service.perPersonPricing.minPersons) * service.perPersonPricing.ratePerPersonCents;
    }
    return 0;
  };

  const servicesTotalCents = selectedServices.reduce(
    (sum, s) => sum + estimatePriceCents(s, pricingInputByService[s.id] ?? {}),
    0,
  );
  const selectedAddons = activeAddons.filter((a) => selectedAddonIds.includes(a.addonId));
  const addonsTotalCents = selectedAddons.reduce((sum, a) => sum + (a.priceCents ?? 0), 0);
  const totalCents = servicesTotalCents + addonsTotalCents;

  // --- Staff ---------------------------------------------------------------------------------
  // Eligible staff = active staff assigned to EVERY currently-selected Service (one staff
  // performs the whole appointment — matches the existing single-staff-selector design; the
  // backend still independently validates eligibility per line, this is only a helpful filter).
  const eligibleStaff = selectedServices.length
    ? selectedServices
        .reduce<{ membershipId: string; name: string }[] | undefined>((acc, service) => {
          const active = service.assignedStaff.filter((m) => m.employmentActive);
          if (!acc) return active.map((m) => ({ membershipId: m.membershipId, name: m.name }));
          return acc.filter((m) => active.some((a) => a.membershipId === m.membershipId));
        }, undefined) ?? []
    : [];

  const [selectedStaffId, setSelectedStaffId] = useState<string | undefined>(undefined);

  // --- Date & time -----------------------------------------------------------------------------
  const [visibleMonthOverride, setVisibleMonthOverride] = useState<Date | undefined>(undefined);
  const visibleMonth = visibleMonthOverride ?? new Date();
  const [selectedDateIso, setSelectedDateIso] = useState<string | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | undefined>(undefined);

  const fromDate = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const toDateObj = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
  const toDate = `${toDateObj.getFullYear()}-${String(toDateObj.getMonth() + 1).padStart(2, "0")}-${String(toDateObj.getDate()).padStart(2, "0")}`;

  const availabilityQuery = useAvailabilityQuery(
    businessId,
    primaryServiceId,
    { fromDate, toDate, staffMembershipId: selectedStaffId },
    Boolean(primaryServiceId) && Boolean(selectedStaffId),
  );

  // --- Notes / tag -----------------------------------------------------------------------------
  const [notes, setNotes] = useState("");

  // One idempotency key per form session — reused across retries of the SAME attempt, never
  // regenerated on a simple error (see BookingCreationClaimRepository's own contract: retrying
  // with the same key safely resolves to the same booking, never a duplicate).
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);

  const createManualBookingMutation = useCreateManualBookingMutation();
  const isSubmitting = createClientMutation.isPending || createManualBookingMutation.isPending;

  const buildClientInput = (): CreateClientInput => ({
    firstName: newFirstName,
    lastName: newLastName || undefined,
    email: newEmail,
    phone: { countryCode: newPhoneCode, nationalNumber: newPhone },
    dateOfBirth: newDob || undefined,
    gender: newGender,
    address: {
      city: newAddress.city as BusinessCity,
      propertyType: newAddress.propertyType as (typeof CLIENT_PROPERTY_TYPES)[number],
      area: newAddress.area,
      streetName: newAddress.streetName,
      streetNumber: newAddress.streetNumber,
      floorUnit: newAddress.floorUnit || undefined,
      aptRoom: newAddress.aptRoom || undefined,
      additionalDirections: newAddress.additionalDirections || undefined,
    },
    tag: newTag || undefined,
  });

  const canSubmit =
    (Boolean(selectedClient) || isAddingNewClient) &&
    selectedServiceIds.length > 0 &&
    Boolean(selectedStaffId) &&
    Boolean(selectedSlot) &&
    !isSubmitting;

  const handleSubmit = async () => {
    setSubmitError(undefined);
    setClientFormErrors({});

    let businessClientId = selectedClient?.id;

    if (isAddingNewClient) {
      const input = buildClientInput();
      const validation = clientInputSchema.safeParse(input);
      if (!validation.success) {
        setClientFormErrors(flattenClientErrors(validation.error));
        return;
      }
      try {
        const client = await createClientMutation.mutateAsync({ businessId, input });
        businessClientId = client.id;
      } catch (error) {
        const fieldErrors = getFieldErrors(error);
        if (Object.keys(fieldErrors).length > 0) {
          setClientFormErrors(fieldErrors);
        } else {
          setSubmitError(toUserMessage(error));
        }
        return;
      }
    }

    if (!businessClientId || !selectedStaffId || !selectedSlot) return;

    const input: CreateManualBookingInput = {
      businessClientId,
      serviceLines: selectedServiceIds.map((serviceId) => ({
        serviceId,
        staffMembershipId: selectedStaffId,
        addonIds: serviceId === primaryServiceId ? selectedAddonIds : [],
        pricingInput: pricingInputByService[serviceId] ?? {},
      })),
      startAt: selectedSlot.startAt,
      notes: notes || undefined,
      idempotencyKey,
      ...(visitType === "TRAVEL_TO_CUSTOMER"
        ? {
            travelAddress: {
              city: addressState.city as BusinessCity,
              propertyType: addressState.propertyType,
              area: addressState.area,
              streetName: addressState.streetName,
              streetNumber: addressState.streetNumber,
              floorUnit: addressState.floorUnit || undefined,
              aptRoom: addressState.aptRoom || undefined,
              additionalDirections: addressState.additionalDirections || undefined,
            },
          }
        : {}),
    };

    try {
      const booking = await createManualBookingMutation.mutateAsync({ businessId, input });
      onCreated(booking.id);
    } catch (error) {
      setSubmitError(toUserMessage(error));
    }
  };

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] select-none">
      {/* New booking Header */}
      <DashboardHeader title="New booking" subtitle="Create a new booking for your business" />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-poppins text-neutral-500 mb-6 select-none">
        <button onClick={onClose} className="hover:text-neutral-900 transition-colors flex items-center gap-1">
          <HugeiconsIcon icon={ArrowLeft02Icon} className="w-3 h-3" />
          <span>All Bookings</span>
        </button>
        <span>&gt;</span>
        <span className="text-[#1A1A1A] font-semibold">New Booking</span>
      </div>

      {/* Main Form container Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
        {/* Left Column - Form */}
        <div className="lg:col-span-8 flex flex-col gap-6 w-full">
          {/* 1. Client Section */}
          <div className="flex flex-col gap-4">
            <span className="font-poppins text-xs font-semibold text-[#5F5E5A] tracking-[0.06em] uppercase">
              Client
            </span>

            {selectedClient ? (
              <div className="bg-white border border-neutral-200/80 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-[#1A1A1A]">
                    {selectedClient.firstName} {selectedClient.lastName ?? ""}
                  </span>
                  <span className="text-xs text-neutral-500 mt-0.5">
                    {selectedClient.phone.countryCode} {selectedClient.phone.nationalNumber} &bull; {selectedClient.email}
                  </span>
                </div>
                <button
                  onClick={clearClient}
                  className="text-xs font-semibold text-[#2E9DA7] hover:underline cursor-pointer"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#5F5E5A] font-poppins">Select client</label>
                  <div className="relative w-full h-9">
                    <span className="absolute left-3 top-2.5 text-neutral-400">
                      <HugeiconsIcon icon={Search01Icon} className="w-4 h-4 text-[#ABAAA6]" />
                    </span>
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Type a client name or mobile number or email..."
                      disabled={isAddingNewClient}
                      className="w-full h-full pl-9 pr-8 bg-white border border-[#E8E8E6] rounded-lg text-xs font-poppins placeholder-neutral-400 focus:outline-none focus:border-neutral-800 disabled:opacity-50"
                    />
                  </div>
                  {clientSearch.trim().length > 0 && !isAddingNewClient && (
                    <div className="bg-white border border-[#E8E8E6] rounded-lg shadow-sm max-h-56 overflow-y-auto flex flex-col mt-1">
                      {clientsQuery.isLoading ? (
                        <span className="px-3 py-2 text-xs text-neutral-400 font-poppins">Searching…</span>
                      ) : (clientsQuery.data?.clients.length ?? 0) === 0 ? (
                        <span className="px-3 py-2 text-xs text-neutral-400 font-poppins">No matching clients.</span>
                      ) : (
                        clientsQuery.data?.clients.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => selectClient(c)}
                            className="px-3 py-2 text-left hover:bg-neutral-50 flex flex-col gap-0.5 text-xs font-poppins border-b border-neutral-50 last:border-b-0"
                          >
                            <span className="font-semibold text-[#1A1A1A]">
                              {c.firstName} {c.lastName ?? ""}
                            </span>
                            <span className="text-neutral-500">
                              {c.phone.countryCode} {c.phone.nationalNumber} &bull; {c.email}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setIsAddingNewClient(true)}
                  className={`self-start text-xs font-semibold px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                    isAddingNewClient
                      ? "bg-[#111111] border-[#111111] text-white"
                      : "bg-white border-neutral-200 text-[#111111] hover:bg-neutral-50"
                  }`}
                >
                  + Add new client
                </button>
              </>
            )}

            {isAddingNewClient && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#5F5E5A] font-poppins">First name</label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="John"
                    className="w-full h-9 px-3 bg-white border border-[#E8E8E4] rounded-lg text-xs font-poppins focus:outline-none focus:border-neutral-800"
                  />
                  {clientFormErrors.firstName && (
                    <span className="text-[10px] text-red-600">{clientFormErrors.firstName}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#5F5E5A] font-poppins">Last name</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full h-9 px-3 bg-white border border-[#E8E8E4] rounded-lg text-xs font-poppins focus:outline-none focus:border-neutral-800"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[#5F5E5A] font-poppins">Date of birth</label>
                    <div className="relative w-full h-9">
                      <span className="absolute left-3 top-2.5">
                        <HugeiconsIcon icon={Calendar03Icon} className="w-4 h-4 text-[#ABAAA6]" />
                      </span>
                      <input
                        type="text"
                        value={newDob}
                        onChange={(e) => setNewDob(e.target.value)}
                        placeholder="1/6/1990"
                        className="w-full h-full pl-9 pr-3 bg-white border border-[#E8E8E4] rounded-lg text-xs font-poppins focus:outline-none focus:border-neutral-800"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[#5F5E5A] font-poppins">Gender</label>
                    <div className="relative w-full h-9">
                      <select
                        value={newGender}
                        onChange={(e) => setNewGender(e.target.value as "male" | "female" | "other")}
                        className="w-full h-full px-3 pr-8 appearance-none bg-white border border-[#E8E8E4] rounded-lg text-xs font-poppins focus:outline-none focus:border-neutral-800 cursor-pointer"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                      <HugeiconsIcon icon={ArrowDown01Icon} className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-neutral-500 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 2. Contact Information Section — only when adding a brand-new client */}
          {isAddingNewClient && (
            <div className="flex flex-col gap-4">
              <span className="font-poppins text-xs font-semibold text-[#5F5E5A] tracking-[0.06em] uppercase">
                Contact Information
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#5F5E5A] font-poppins">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full h-9 px-3 bg-white border border-[#E8E8E4] rounded-lg text-xs font-poppins focus:outline-none focus:border-neutral-800"
                  />
                  {clientFormErrors.email && <span className="text-[10px] text-red-600">{clientFormErrors.email}</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#5F5E5A] font-poppins">Phone</label>
                  <div className="flex items-center">
                    <div className="relative w-24 h-9 shrink-0">
                      <div
                        onClick={() => setIsPhoneDropdownOpen(!isPhoneDropdownOpen)}
                        className="w-full h-full border border-[#E8E8E4] border-r-0 rounded-l-lg bg-white flex items-center justify-between px-2.5 cursor-pointer text-xs font-poppins focus:outline-none select-none"
                      >
                        <div className="flex items-center gap-1.5">
                          <Image src={newPhoneCode === "+357" ? "https://flagcdn.com/w20/cy.png" : "https://flagcdn.com/w20/us.png"} alt="flag" className="w-5 h-3.5 object-cover rounded-sm" draggable="false" width={20} height={12} />
                          <span>{newPhoneCode}</span>
                        </div>
                        <HugeiconsIcon icon={ArrowDown01Icon} className="w-3 h-3 text-neutral-400" />
                      </div>

                      {isPhoneDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsPhoneDropdownOpen(false)} />
                          <div className="absolute left-0 top-10 z-50 bg-white border border-neutral-200/80 rounded-lg shadow-xl w-36 py-1 flex flex-col text-xs font-poppins">
                            <button
                              type="button"
                              onClick={() => {
                                setNewPhoneCode("+357");
                                setIsPhoneDropdownOpen(false);
                              }}
                              className="px-3 py-2 hover:bg-neutral-50 flex items-center gap-2 text-left w-full transition-colors"
                            >
                              <Image src="https://flagcdn.com/w20/cy.png" alt="Cyprus flag" className="w-5 h-3.5 object-cover rounded-sm" width={20} height={12} />
                              <span>Cyprus (+357)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setNewPhoneCode("+1");
                                setIsPhoneDropdownOpen(false);
                              }}
                              className="px-3 py-2 hover:bg-neutral-50 flex items-center gap-2 text-left w-full transition-colors"
                            >
                              <Image src="https://flagcdn.com/w20/us.png" alt="US flag" className="w-5 h-3.5 object-cover rounded-sm" width={20} height={12} />
                              <span>US (+1)</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <input
                      type="text"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="99111111"
                      className="w-full h-9 px-3 bg-white border border-[#E8E8E4] rounded-r-lg text-xs font-poppins focus:outline-none focus:border-neutral-800"
                    />
                  </div>
                  {clientFormErrors["phone.nationalNumber"] && (
                    <span className="text-[10px] text-red-600">{clientFormErrors["phone.nationalNumber"]}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ADDRESS card — new client's own address, or an existing TRAVEL_TO_CUSTOMER client's
              appointment address for this booking specifically. */}
          {requiresAddress && (
            <div className="border border-neutral-200/80 rounded-xl p-5 flex flex-col gap-4 bg-white shadow-sm">
              <span className="font-poppins text-xs font-bold text-[#5F5E5A] tracking-wider uppercase">
                {isAddingNewClient ? "Address" : "Appointment location"}
              </span>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#5F5E5A] font-poppins">City *</label>
                <div className="relative w-full h-9">
                  <select
                    value={addressState.city}
                    onChange={(e) => setAddressField({ city: e.target.value as BusinessCity })}
                    className="w-full h-full px-3 pr-8 appearance-none bg-white border border-[#E8E8E4] rounded-lg text-xs font-poppins focus:outline-none focus:border-neutral-800 cursor-pointer"
                  >
                    <option value="">Select city</option>
                    {BUSINESS_CITIES.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                  <HugeiconsIcon icon={ArrowDown01Icon} className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-neutral-500 pointer-events-none" />
                </div>
                {clientFormErrors["address.city"] && <span className="text-[10px] text-red-600">{clientFormErrors["address.city"]}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#5F5E5A] font-poppins">Property type *</label>
                <div className="relative w-full h-9">
                  <select
                    value={addressState.propertyType}
                    onChange={(e) => setAddressField({ propertyType: e.target.value as (typeof CLIENT_PROPERTY_TYPES)[number] })}
                    className="w-full h-full px-3 pr-8 appearance-none bg-white border border-[#E8E8E4] rounded-lg text-xs font-poppins focus:outline-none focus:border-neutral-800 cursor-pointer"
                  >
                    <option value="">Select property type</option>
                    {CLIENT_PROPERTY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <HugeiconsIcon icon={ArrowDown01Icon} className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-neutral-500 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#5F5E5A] font-poppins">Area/neighborhood *</label>
                <input
                  type="text"
                  value={addressState.area}
                  onChange={(e) => setAddressField({ area: e.target.value })}
                  placeholder="e.g. Mackenzie, finikoudes"
                  className="w-full h-9 px-3 bg-white border border-[#E8E8E4] rounded-lg text-xs font-poppins focus:outline-none focus:border-neutral-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#5F5E5A] font-poppins">Street name *</label>
                  <input
                    type="text"
                    value={addressState.streetName}
                    onChange={(e) => setAddressField({ streetName: e.target.value })}
                    placeholder="e.g. Emrou"
                    className="w-full h-9 px-3 bg-white border border-[#E8E8E4] rounded-lg text-xs font-poppins focus:outline-none focus:border-neutral-800"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#5F5E5A] font-poppins">Street number *</label>
                  <input
                    type="text"
                    value={addressState.streetNumber}
                    onChange={(e) => setAddressField({ streetNumber: e.target.value })}
                    placeholder="e.g. 14"
                    className="w-full h-9 px-3 bg-white border border-[#E8E8E4] rounded-lg text-xs font-poppins focus:outline-none focus:border-neutral-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#5F5E5A] font-poppins">Floor /unit</label>
                  <input
                    type="text"
                    value={addressState.floorUnit}
                    onChange={(e) => setAddressField({ floorUnit: e.target.value })}
                    placeholder="e.g. 3rd floor"
                    className="w-full h-9 px-3 bg-white border border-[#E8E8E4] rounded-lg text-xs font-poppins focus:outline-none focus:border-neutral-800"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#5F5E5A] font-poppins">Apt/room no.</label>
                  <input
                    type="text"
                    value={addressState.aptRoom}
                    onChange={(e) => setAddressField({ aptRoom: e.target.value })}
                    placeholder="e.g. 5"
                    className="w-full h-9 px-3 bg-white border border-[#E8E8E4] rounded-lg text-xs font-poppins focus:outline-none focus:border-neutral-800"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#5F5E5A] font-poppins">Additional directions</label>
                <textarea
                  value={addressState.additionalDirections}
                  onChange={(e) => setAddressField({ additionalDirections: e.target.value })}
                  placeholder="e.g. Blue gate on the left, ring twice."
                  rows={3}
                  className="w-full p-3 bg-white border border-[#E8E8E4] rounded-lg text-xs font-poppins focus:outline-none focus:border-neutral-800 resize-none leading-relaxed text-[#111111]"
                />
              </div>
            </div>
          )}

          {/* 3. Service Section */}
          <div className="flex flex-col gap-4">
            <span className="font-poppins text-xs font-semibold text-[#5F5E5A] tracking-[0.06em] uppercase">
              Service
            </span>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#5F5E5A] font-poppins">Select service</label>
              <div className="relative w-full h-9">
                <select
                  onChange={(e) => {
                    addService(e.target.value);
                    e.target.value = "";
                  }}
                  defaultValue=""
                  disabled={servicesQuery.isLoading || atServiceLimit}
                  className="w-full h-full px-3 pr-8 appearance-none bg-white border border-[#E8E8E4] rounded-lg text-xs font-poppins focus:outline-none focus:border-neutral-800 cursor-pointer text-[#ABAAA6] font-medium disabled:opacity-50"
                >
                  <option value="">
                    {servicesQuery.isLoading
                      ? "Loading services…"
                      : atServiceLimit
                        ? `Limit reached (max ${maxServicesPerBooking} services)`
                        : "Choose a service..."}
                  </option>
                  {bookableServices
                    .filter((s) => !selectedServiceIds.includes(s.id))
                    .map((s) => {
                      const price = formatServicePrice(s);
                      const duration = formatServiceDuration(s);
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name} ({price.amount}
                          {price.suffix ? ` ${price.suffix}` : ""}
                          {duration ? `, ${duration}` : ""})
                        </option>
                      );
                    })}
                </select>
                <HugeiconsIcon icon={ArrowDown01Icon} className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-neutral-500 pointer-events-none" />
              </div>
            </div>

            {/* Added services list */}
            {selectedServices.map((svc) => {
              const input = pricingInputByService[svc.id] ?? {};
              return (
                <div key={svc.id} className="bg-white border border-neutral-200/50 rounded-xl p-4 flex flex-col gap-3 shadow-sm select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-inter font-medium text-[17px] text-[#0D0D0D]">{svc.name}</span>
                      <span className="font-inter text-xs text-[#767676] mt-0.5">{formatServiceDuration(svc) ?? ""}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-inter font-medium text-lg text-[#0D0D0D]">{formatEuro(estimatePriceCents(svc, input))}</span>
                      <button
                        onClick={() => removeService(svc.id)}
                        className="w-6 h-6 rounded-full hover:bg-neutral-100 flex items-center justify-center transition-all"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4 text-[#0C0C0C]" />
                      </button>
                    </div>
                  </div>

                  {svc.pricingMode === "HOURLY" && svc.hourlyPricing && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-[#0d0d0d]">Hours</span>
                      <div className="flex items-center border border-neutral-300 rounded-lg overflow-hidden h-8">
                        <button
                          onClick={() =>
                            setPricingInputByService((prev) => ({
                              ...prev,
                              [svc.id]: { hours: Math.max((prev[svc.id]?.hours ?? svc.hourlyPricing!.minHours) - 1, svc.hourlyPricing!.minHours) },
                            }))
                          }
                          className="px-3 hover:bg-neutral-100 font-bold border-r border-neutral-300 text-sm"
                        >
                          -
                        </button>
                        <span className="px-4 text-xs font-semibold">{input.hours ?? svc.hourlyPricing.minHours}</span>
                        <button
                          onClick={() =>
                            setPricingInputByService((prev) => ({
                              ...prev,
                              [svc.id]: { hours: Math.min((prev[svc.id]?.hours ?? svc.hourlyPricing!.minHours) + 1, svc.hourlyPricing!.maxHours) },
                            }))
                          }
                          className="px-3 hover:bg-neutral-100 font-bold border-l border-neutral-300 text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  {svc.pricingMode === "PER_PERSON" && svc.perPersonPricing && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-[#0d0d0d]">Persons</span>
                      <div className="flex items-center border border-neutral-300 rounded-lg overflow-hidden h-8">
                        <button
                          onClick={() =>
                            setPricingInputByService((prev) => ({
                              ...prev,
                              [svc.id]: { personCount: Math.max((prev[svc.id]?.personCount ?? svc.perPersonPricing!.minPersons) - 1, svc.perPersonPricing!.minPersons) },
                            }))
                          }
                          className="px-3 hover:bg-neutral-100 font-bold border-r border-neutral-300 text-sm"
                        >
                          -
                        </button>
                        <span className="px-4 text-xs font-semibold">{input.personCount ?? svc.perPersonPricing.minPersons}</span>
                        <button
                          onClick={() =>
                            setPricingInputByService((prev) => ({
                              ...prev,
                              [svc.id]: { personCount: Math.min((prev[svc.id]?.personCount ?? svc.perPersonPricing!.minPersons) + 1, svc.perPersonPricing!.maxPersons) },
                            }))
                          }
                          className="px-3 hover:bg-neutral-100 font-bold border-l border-neutral-300 text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 4. Add-ons Section */}
          <div className={`flex flex-col gap-4 ${selectedServiceIds.length === 0 ? "opacity-40 pointer-events-none select-none" : ""}`}>
            <span className="font-poppins text-xs font-semibold text-[#5F5E5A] tracking-[0.06em] uppercase">
              Add-ons
            </span>
            {selectedServiceIds.length > 1 && (
              <p className="text-[10px] text-neutral-400 font-poppins -mt-2">
                Add-ons apply to the first selected service ({selectedServices[0]?.name}).
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#5F5E5A] font-poppins">Select add-ons</label>
              <div className="relative w-full h-9">
                <select
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && !selectedAddonIds.includes(val)) {
                      setSelectedAddonIds([...selectedAddonIds, val]);
                    }
                    e.target.value = "";
                  }}
                  defaultValue=""
                  className="w-full h-full px-3 pr-8 appearance-none bg-white border border-[#E8E8E4] rounded-lg text-xs font-poppins focus:outline-none focus:border-neutral-800 cursor-pointer text-[#ABAAA6] font-medium"
                >
                  <option value="">
                    {addonsQuery.isLoading ? "Loading add-ons…" : activeAddons.length === 0 ? "No add-ons available" : "Choose add-ons..."}
                  </option>
                  {activeAddons
                    .filter((a) => !selectedAddonIds.includes(a.addonId))
                    .map((a) => (
                      <option key={a.addonId} value={a.addonId}>
                        {a.name} {a.priceCents !== undefined ? `(${formatEuro(a.priceCents)})` : ""}
                      </option>
                    ))}
                </select>
                <HugeiconsIcon icon={ArrowDown01Icon} className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-neutral-500 pointer-events-none" />
              </div>
            </div>

            {selectedAddons.map((addon) => (
              <div key={addon.addonId} className="bg-white border border-neutral-200/50 rounded-xl p-4 flex items-center justify-between shadow-sm select-none">
                <span className="font-inter font-medium text-[17px] text-[#0D0D0D]">{addon.name}</span>
                <div className="flex items-center gap-4">
                  <span className="font-inter font-medium text-lg text-[#0D0D0D]">
                    {addon.priceCents !== undefined ? formatEuro(addon.priceCents) : "—"}
                  </span>
                  <button
                    onClick={() => setSelectedAddonIds(selectedAddonIds.filter((id) => id !== addon.addonId))}
                    className="w-6 h-6 rounded-full hover:bg-neutral-100 flex items-center justify-center transition-all"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4 text-[#0C0C0C]" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 5. Staff Section */}
          <div className="flex flex-col gap-3">
            <span className="font-poppins text-xs font-semibold text-[#5F5E5A] tracking-[0.06em] uppercase">
              Staff
            </span>
            {selectedServiceIds.length === 0 ? (
              <p className="text-xs text-neutral-400 font-poppins">Select a service first to see eligible staff.</p>
            ) : eligibleStaff.length === 0 ? (
              <p className="text-xs text-neutral-400 font-poppins">No single staff member can perform all selected services.</p>
            ) : (
              <div className="flex flex-wrap gap-4 select-none">
                {eligibleStaff.map((staff) => {
                  const isSelected = selectedStaffId === staff.membershipId;
                  return (
                    <button
                      key={staff.membershipId}
                      onClick={() => {
                        setSelectedStaffId(staff.membershipId);
                        setSelectedDateIso(undefined);
                        setSelectedSlot(undefined);
                      }}
                      className={`bg-white px-3 py-2 border rounded-xl flex items-center gap-3 transition-all min-w-[120px] shadow-sm ${
                        isSelected ? "border-[#000000] ring-1 ring-black" : "border-neutral-200 hover:border-neutral-400"
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-[#D9D9D9] flex items-center justify-center text-[10px] font-bold text-neutral-600 shrink-0">
                        {staff.name.charAt(0)}
                      </div>
                      <span className="text-[13px] font-semibold text-[#0D0D0D]">{staff.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 6. Date & Time Section */}
          <div className="flex flex-col gap-4">
            <span className="font-poppins text-xs font-semibold text-[#5F5E5A] tracking-[0.06em] uppercase">
              Date &amp; Time
            </span>
            {!primaryServiceId || !selectedStaffId ? (
              <p className="text-xs text-neutral-400 font-poppins">Select a service and staff member to see real availability.</p>
            ) : (
              <TimeStep
                timezone={availabilityQuery.data?.timezone ?? "UTC"}
                visibleMonth={visibleMonth}
                onPrevMonth={() => setVisibleMonthOverride(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
                onNextMonth={() => setVisibleMonthOverride(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
                availability={availabilityQuery.data}
                isLoading={availabilityQuery.isLoading}
                selectedDateIso={selectedDateIso}
                onSelectDate={(dateIso) => {
                  setSelectedDateIso(dateIso);
                  setSelectedSlot(undefined);
                }}
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
              />
            )}
          </div>

          {/* 7. Client Tag — only meaningful for a brand-new client */}
          {isAddingNewClient && (
            <div className="flex flex-col gap-3">
              <span className="font-poppins text-xs font-semibold text-[#5F5E5A] tracking-[0.06em] uppercase">
                Client tag
              </span>
              <div className="flex flex-wrap gap-2">
                {CLIENT_TAGS.map((tagName) => {
                  const isSelected = newTag === tagName;
                  return (
                    <button
                      key={tagName}
                      onClick={() => setNewTag(isSelected ? "" : tagName)}
                      className={`px-3.5 py-1 text-xs font-medium rounded-full border transition-all ${
                        isSelected
                          ? "bg-[#FAEEDA] border-[#633806] text-[#633806] font-semibold"
                          : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                      }`}
                    >
                      {tagName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 8. Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[#5F5E5A] font-poppins">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes visible to staff only.."
              rows={3}
              className="w-full p-3 bg-white border border-[#E8E8E4] rounded-lg text-xs font-poppins focus:outline-none focus:border-neutral-800 resize-none leading-relaxed text-[#111111]"
            />
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className="lg:col-span-4 flex flex-col gap-6 w-full lg:sticky lg:top-4">
          <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-sm flex flex-col gap-5 select-none">
            <h3 className="text-sm font-semibold text-[#0F1E35] font-poppins">Booking summary</h3>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <HugeiconsIcon icon={UserCircle02Icon} className="w-5 h-5 text-neutral-400 shrink-0" />
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] uppercase font-semibold text-neutral-400 font-poppins">Client</span>
                  <span className="text-xs font-semibold text-[#1A1A1A] mt-1">
                    {selectedClient
                      ? `${selectedClient.firstName} ${selectedClient.lastName ?? ""}`.trim()
                      : isAddingNewClient
                        ? newFirstName || "—"
                        : "—"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <HugeiconsIcon icon={Note02Icon} className="w-5 h-5 text-neutral-400 shrink-0" />
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] uppercase font-semibold text-neutral-400 font-poppins">Service</span>
                  <span className="text-xs font-semibold text-[#1A1A1A] mt-1">
                    {selectedServices.map((s) => s.name).join(", ") || "—"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <HugeiconsIcon icon={Calendar03Icon} className="w-5 h-5 text-neutral-400 shrink-0" />
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] uppercase font-semibold text-neutral-400 font-poppins">Date</span>
                  <span className="text-xs font-semibold text-[#1A1A1A] mt-1">{selectedDateIso ?? "—"}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <HugeiconsIcon icon={Clock01Icon} className="w-5 h-5 text-neutral-400 shrink-0" />
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] uppercase font-semibold text-neutral-400 font-poppins">Time</span>
                  <span className="text-xs font-semibold text-[#1A1A1A] mt-1">
                    {selectedSlot
                      ? new Intl.DateTimeFormat("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                          timeZone: availabilityQuery.data?.timezone ?? "UTC",
                        }).format(new Date(selectedSlot.startAt))
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <HugeiconsIcon icon={UserIcon} className="w-5 h-5 text-neutral-400 shrink-0" />
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] uppercase font-semibold text-neutral-400 font-poppins">Staff</span>
                  <span className="text-xs font-semibold text-[#1A1A1A] mt-1">
                    {eligibleStaff.find((s) => s.membershipId === selectedStaffId)?.name ?? "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-100 pt-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-neutral-500 font-poppins">
                <span>Service total</span>
                <span>{formatEuro(totalCents)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold text-[#1A1A1A] font-poppins">
                <span>Balance due at venue</span>
                <span>{formatEuro(totalCents)}</span>
              </div>
            </div>

            {submitError && (
              <p className="text-[11px] text-red-600 font-poppins leading-relaxed">{submitError}</p>
            )}

            <div className="flex flex-col gap-2.5 mt-2">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full py-2.5 bg-[#111111] hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-all font-poppins shadow-sm"
              >
                {isSubmitting ? "Creating…" : "Create booking"}
              </button>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="w-full py-2.5 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 bg-white rounded-lg text-xs font-semibold transition-all font-poppins shadow-sm disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            <p className="text-[10px] text-neutral-400 text-center leading-normal font-poppins">
              Fill in all required fields to continue
            </p>
          </div>
        </div>
      </div>

      </div></main>
  );
}
