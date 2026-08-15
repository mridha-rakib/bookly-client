export interface Staff {
  id: number | string;
  name: string;
  role: "Owner" | "Supervisor" | "Staff";
  subRole: string;
  avatarText: string;
  avatarBg: string;
  servicesAssigned: string;
  schedule: string;
  status: "Active" | "Inactive";
  cardRoleText?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface TableRow {
  name: string;
  role: string;
  avatarText: string;
  avatarBg: string;
  shifts: string[];
  timeoff: string;
  services: string;
  accessTitle: string;
  accessSubtitle: string;
  avatarUrl?: string;
}

export const initialStaffMembers: Staff[] = [
  {
    id: 1,
    name: "Elena G.",
    role: "Owner",
    subRole: "Owner - All services",
    avatarText: "EG",
    avatarBg: "bg-[#7C3AED]",
    servicesAssigned: "All 6 services assigned",
    schedule: "Mon-Fri 09:00-20:00 • Sat 10:00-16:00",
    status: "Active",
    email: "elena@example.com",
    phone: "+357 99 111222"
  },
  {
    id: 2,
    name: "Vivi M.",
    role: "Supervisor",
    subRole: "Nail Technician",
    avatarText: "VM",
    avatarBg: "bg-[#EC4899]",
    servicesAssigned: "Manicure & Gel, Bridal Make-up",
    schedule: "Tue-Sat 10:00-18:00",
    status: "Active",
    cardRoleText: "Staff",
    email: "vivi@example.com",
    phone: "+357 99 333444"
  },
  {
    id: 3,
    name: "Rania A.",
    role: "Staff",
    subRole: "Make-up Artist",
    avatarText: "RA",
    avatarBg: "bg-[#10B981]",
    servicesAssigned: "Full Make-up, Manicure & Gel",
    schedule: "Mon, Wed, Fri 10:00-17:00",
    status: "Inactive",
    cardRoleText: "Staff",
    email: "rania@example.com",
    phone: "+357 99 555666"
  }
];

export const availabilityTableData: TableRow[] = [
  {
    name: "Elena G.",
    role: "Owner",
    avatarText: "EG",
    avatarBg: "bg-[#4FA17F]",
    shifts: [
      "Mon-Thu · 09:00-13:00, 16:00-20:00",
      "Fri · 09:00-13:00",
      "Sat · 10:00-16:00"
    ],
    timeoff: "None",
    services: "All services",
    accessTitle: "Full access",
    accessSubtitle: "Including financials"
  },
  {
    name: "Vivi M.",
    role: "Supervisor",
    avatarText: "VM",
    avatarBg: "bg-[#8175D8]",
    shifts: [
      "Tue-Fri · 10:00-18:00",
      "Sat · 10:00-15:00"
    ],
    timeoff: "2-6 Jun (holiday)",
    services: "Manicure, Bridal",
    accessTitle: "Full access",
    accessSubtitle: "No financials"
  },
  {
    name: "Rania A.",
    role: "Staff",
    avatarText: "RA",
    avatarBg: "bg-[#CF5E87]",
    shifts: [
      "Mon, Wed, Fri · 10:00-17:00"
    ],
    timeoff: "Sick leave",
    services: "Make-up, Manicure",
    accessTitle: "Own bookings only",
    accessSubtitle: "No financials"
  },
  {
    name: "Nikos K.",
    role: "Staff",
    avatarText: "NK",
    avatarBg: "bg-[#4D8EDC]",
    shifts: [
      "Mon-Fri · 09:00-17:00"
    ],
    timeoff: "8-15 Jun (holiday)",
    services: "Lash Extensions, Lash Lift",
    accessTitle: "Own bookings only",
    accessSubtitle: "No financials"
  }
];
