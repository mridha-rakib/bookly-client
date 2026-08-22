"use client";

import { useEffect, useRef, useState } from "react";

import { toast } from "@/components/ui/sonner";
import type { BusinessClientDto, CreateClientInput } from "@/lib/api/clients";
import { getFieldErrors, toUserMessage } from "@/lib/auth/messages";
import {
  useArchiveClientMutation,
  useClientQuery,
  useClientsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
} from "@/lib/clients/hooks";
import { flattenClientErrors, clientInputSchema } from "@/lib/clients/schema";
import { useStaffListQuery } from "@/lib/staff/hooks";
import ArchivedClientsList from "./ArchivedClientsList";
import ClientDetails from "./ClientDetails";
import ClientForm from "./ClientForm";
import ClientsList from "./ClientsList";

const phoneCountries = [
  { name: "Cyprus", code: "+357", flag: "cy" },
  { name: "Bangladesh", code: "+880", flag: "bd" },
  { name: "Greece", code: "+30", flag: "gr" },
  { name: "United Kingdom", code: "+44", flag: "gb" },
  { name: "United States", code: "+1", flag: "us" },
];

const flagForCode = (code: string) => phoneCountries.find((c) => c.code === code)?.flag ?? "cy";

const tagBgFor = (tag: string | null) =>
  tag === "VIP"
    ? "bg-[#FAEEDA]"
    : tag === "No-show"
      ? "bg-[#FCE4E4]"
      : tag === "New"
        ? "bg-[#E6F1FB]"
        : "bg-neutral-100";

const tagColorFor = (tag: string | null) =>
  tag === "VIP"
    ? "text-[#633806]"
    : tag === "No-show"
      ? "text-[#E42424]"
      : tag === "New"
        ? "text-[#0C447C]"
        : "text-neutral-600";

const formatSince = (isoDate: string) => {
  const date = new Date(isoDate);
  return `Since ${date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
};

const toClientRow = (dto: BusinessClientDto) => ({
  id: dto.id,
  name: `${dto.firstName} ${dto.lastName ?? ""}`.trim(),
  joined: formatSince(dto.createdAt),
  phone: `${dto.phone.countryCode} ${dto.phone.nationalNumber}`,
  tag: dto.tag ?? null,
  tagBg: tagBgFor(dto.tag ?? null),
  tagColor: tagColorFor(dto.tag ?? null),
  avatarBg: "bg-[#E1F5EE]",
  avatarText: `${dto.firstName.charAt(0)}${dto.lastName?.charAt(0) ?? ""}`.toUpperCase(),
  linkState: dto.linkState,
});

type ViewMode = "list" | "add" | "edit" | "view" | "archived";

interface ClientsPageProps {
  businessId: string | undefined;
}

export default function ClientsPage({ businessId }: ClientsPageProps) {
  const [mode, setMode] = useState<ViewMode>("list");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [openActionIdx, setOpenActionIdx] = useState<number | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientDob, setClientDob] = useState("");
  const [clientGender, setClientGender] = useState("Male");
  const [clientCity, setClientCity] = useState("");
  const [clientPropertyType, setClientPropertyType] = useState("");
  const [clientArea, setClientArea] = useState("");
  const [clientStreetName, setClientStreetName] = useState("");
  const [clientStreetNumber, setClientStreetNumber] = useState("");
  const [clientFloor, setClientFloor] = useState("");
  const [clientAptNo, setClientAptNo] = useState("");
  const [clientDirections, setClientDirections] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [clientTag, setClientTagState] = useState("VIP");
  const [clientAvatar, setClientAvatar] = useState("");
  const clientAvatarInputRef = useRef<HTMLInputElement>(null);
  const [clientPhoneCode, setClientPhoneCode] = useState("+357");
  const [clientPhoneFlag, setClientPhoneFlag] = useState("cy");
  const [isClientPhoneDropdownOpen, setIsClientPhoneDropdownOpen] = useState(false);

  const listQuery = useClientsQuery(businessId, { limit: 100, archived: false }, mode !== "archived");
  const selectedClientQuery = useClientQuery(businessId, selectedClientId ?? undefined);
  const staffListQuery = useStaffListQuery(businessId);

  const createMutation = useCreateClientMutation();
  const updateMutation = useUpdateClientMutation();
  const archiveMutation = useArchiveClientMutation();

  const resetForm = () => {
    setClientFirstName("");
    setClientLastName("");
    setClientPhone("");
    setClientEmail("");
    setClientDob("");
    setClientGender("Male");
    setClientCity("");
    setClientPropertyType("");
    setClientArea("");
    setClientStreetName("");
    setClientStreetNumber("");
    setClientFloor("");
    setClientAptNo("");
    setClientDirections("");
    setClientNotes("");
    setClientTagState("VIP");
    setClientAvatar("");
    setClientPhoneCode("+357");
    setClientPhoneFlag("cy");
    setFormErrors({});
  };

  // Hydrates the (lifted, ClientForm-shaped) field state once the real record loads for Edit —
  // same pattern as ServiceForm's hydrateFromService effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode !== "edit" || !selectedClientQuery.data) return;
    const dto = selectedClientQuery.data;
    setClientFirstName(dto.firstName);
    setClientLastName(dto.lastName ?? "");
    setClientPhone(dto.phone.nationalNumber);
    setClientPhoneCode(dto.phone.countryCode);
    setClientPhoneFlag(flagForCode(dto.phone.countryCode));
    setClientEmail(dto.email);
    setClientDob(dto.dateOfBirth ?? "");
    setClientGender(dto.gender ? dto.gender[0]!.toUpperCase() + dto.gender.slice(1) : "Male");
    setClientCity(dto.address.city);
    setClientPropertyType(dto.address.propertyType);
    setClientArea(dto.address.area);
    setClientStreetName(dto.address.streetName);
    setClientStreetNumber(dto.address.streetNumber);
    setClientFloor(dto.address.floorUnit ?? "");
    setClientAptNo(dto.address.aptRoom ?? "");
    setClientNotes(dto.notes ?? "");
    setClientTagState(dto.tag ?? "VIP");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedClientQuery.data?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const buildInput = (): CreateClientInput => ({
    firstName: clientFirstName,
    lastName: clientLastName || undefined,
    email: clientEmail,
    phone: { countryCode: clientPhoneCode, nationalNumber: clientPhone },
    dateOfBirth: clientDob || undefined,
    gender: clientGender.toLowerCase() as "male" | "female" | "other",
    address: {
      city: clientCity as CreateClientInput["address"]["city"],
      propertyType: clientPropertyType as CreateClientInput["address"]["propertyType"],
      area: clientArea,
      streetName: clientStreetName,
      streetNumber: clientStreetNumber,
      floorUnit: clientFloor || undefined,
      aptRoom: clientAptNo || undefined,
      additionalDirections: clientDirections || undefined,
    },
    notes: clientNotes || undefined,
    tag: (clientTag || undefined) as CreateClientInput["tag"],
  });

  const goToList = () => {
    setMode("list");
    setSelectedClientId(null);
    resetForm();
  };

  const handleAddClient = () => {
    if (!businessId) return;
    const input = buildInput();
    const validation = clientInputSchema.safeParse(input);
    if (!validation.success) {
      setFormErrors(flattenClientErrors(validation.error));
      return;
    }
    setFormErrors({});
    createMutation.mutate(
      { businessId, input },
      {
        onSuccess: () => {
          toast.success("Client added");
          goToList();
        },
        onError: (error) => {
          const fieldErrors = getFieldErrors(error);
          setFormErrors(
            Object.keys(fieldErrors).length > 0 ? fieldErrors : { root: toUserMessage(error) },
          );
        },
      },
    );
  };

  const handleSaveClient = () => {
    if (!businessId || !selectedClientId) return;
    const isLinked = selectedClientQuery.data?.linkState === "LINKED";
    const input = buildInput();
    const validation = clientInputSchema.safeParse(input);
    if (!validation.success) {
      setFormErrors(flattenClientErrors(validation.error));
      return;
    }
    setFormErrors({});
    // Linked identity fields are already disabled in the form, but strip them defensively too
    // (matches the server's own rejection — see client.service.ts CLIENT_IDENTITY_LOCKED).
    const body = isLinked
      ? { address: input.address, notes: input.notes, tag: input.tag, dateOfBirth: input.dateOfBirth }
      : input;
    updateMutation.mutate(
      { businessId, clientId: selectedClientId, input: body },
      {
        onSuccess: () => {
          toast.success("Client updated");
          goToList();
        },
        onError: (error) => {
          const fieldErrors = getFieldErrors(error);
          setFormErrors(
            Object.keys(fieldErrors).length > 0 ? fieldErrors : { root: toUserMessage(error) },
          );
        },
      },
    );
  };

  if (mode === "archived" && businessId) {
    return <ArchivedClientsList businessId={businessId} onBack={goToList} />;
  }

  if (mode === "view") {
    const dto = selectedClientQuery.data;
    if (!dto) {
      return (
        <main className="flex-1 flex items-center justify-center bg-[#FCF8F8] text-sm text-neutral-500">
          Loading client…
        </main>
      );
    }
    return (
      <ClientDetails
        businessId={businessId}
        clientId={selectedClientId ?? undefined}
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
        setIsViewingClient={(val) => {
          if (!val) setMode("edit");
        }}
        setEditingClientIndex={(idx) => {
          if (idx === null) goToList();
        }}
      />
    );
  }

  if (mode === "add" || mode === "edit") {
    const isLinked = mode === "edit" && selectedClientQuery.data?.linkState === "LINKED";
    return (
      <ClientForm
        editingClientIndex={mode === "edit" ? 0 : null}
        isViewingClient={false}
        setIsAddingClient={(val) => {
          if (!val) goToList();
        }}
        setEditingClientIndex={(idx) => {
          if (idx === null) goToList();
        }}
        setIsViewingClient={() => {}}
        clientFirstName={clientFirstName}
        setClientFirstName={setClientFirstName}
        clientLastName={clientLastName}
        setClientLastName={setClientLastName}
        clientPhone={clientPhone}
        setClientPhone={setClientPhone}
        clientEmail={clientEmail}
        setClientEmail={setClientEmail}
        clientDob={clientDob}
        setClientDob={setClientDob}
        clientGender={clientGender}
        setClientGender={setClientGender}
        clientCity={clientCity}
        setClientCity={setClientCity}
        clientPropertyType={clientPropertyType}
        setClientPropertyType={setClientPropertyType}
        clientArea={clientArea}
        setClientArea={setClientArea}
        clientStreetName={clientStreetName}
        setClientStreetName={setClientStreetName}
        clientStreetNumber={clientStreetNumber}
        setClientStreetNumber={setClientStreetNumber}
        clientFloor={clientFloor}
        setClientFloor={setClientFloor}
        clientAptNo={clientAptNo}
        setClientAptNo={setClientAptNo}
        clientDirections={clientDirections}
        setClientDirections={setClientDirections}
        clientNotes={clientNotes}
        setClientNotes={setClientNotes}
        clientTag={clientTag}
        setClientTagState={setClientTagState}
        clientAvatar={clientAvatar}
        clientAvatarInputRef={clientAvatarInputRef}
        handleClientAvatarChange={() => {
          // Client avatar upload has no backing endpoint yet — intentionally a no-op rather
          // than fabricating a fake upload; the picker stays visible per the Figma layout.
        }}
        clientPhoneCode={clientPhoneCode}
        setClientPhoneCode={setClientPhoneCode}
        clientPhoneFlag={clientPhoneFlag}
        setClientPhoneFlag={setClientPhoneFlag}
        isClientPhoneDropdownOpen={isClientPhoneDropdownOpen}
        setIsClientPhoneDropdownOpen={setIsClientPhoneDropdownOpen}
        phoneCountries={phoneCountries}
        handleSaveClient={handleSaveClient}
        handleAddClient={handleAddClient}
        identityFieldsDisabled={isLinked}
        serverErrors={formErrors}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    );
  }

  const rows = (listQuery.data?.clients ?? []).map(toClientRow);

  return (
    <ClientsList
      clientsData={rows}
      setClientsData={() => {}}
      setIsAddingClient={(val) => {
        if (val) {
          resetForm();
          setMode("add");
        }
      }}
      setIsViewingClient={() => {}}
      setEditingClientIndex={() => {}}
      openActionIdx={openActionIdx}
      setOpenActionIdx={setOpenActionIdx}
      metrics={
        listQuery.data
          ? { totalClients: listQuery.data.stats.totalClients, newThisMonth: listQuery.data.stats.newThisMonth }
          : undefined
      }
      staffOptions={staffListQuery.data?.members.map((member) => member.name)}
      disableStaffFilter
      onViewClient={(client) => {
        if (!client.id) return;
        setSelectedClientId(client.id);
        setMode("view");
      }}
      onEditClient={(client) => {
        if (!client.id) return;
        setSelectedClientId(client.id);
        setMode("edit");
      }}
      onDeleteClient={(client) => {
        if (!businessId || !client.id) return;
        archiveMutation.mutate(
          { businessId, clientId: client.id },
          {
            onSuccess: () => toast.success(`${client.name} archived`),
            onError: (error) => toast.error(toUserMessage(error)),
          },
        );
      }}
      onArchivedClientsClick={() => setMode("archived")}
    />
  );
}
