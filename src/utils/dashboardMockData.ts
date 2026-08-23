import { StarIcon, CalendarCheckIcon, ReceiptTextIcon, Cancel01Icon } from "@hugeicons/core-free-icons";

export const initialClientsData = [
  {
    name: "Sara L.",
    joined: "Since Jan 2024",
    phone: "+357 99 123 456",
    visitText: "11 May 2026",
    visitSub: "Last visit",
    isNext: false,
    visits: 18,
    spent: "€1,440",
    tag: "VIP",
    tagBg: "bg-[#FAEEDA]",
    tagColor: "text-[#633806]",
    avatarBg: "bg-[#E1F5EE]",
    avatarText: "SL"
  },
  {
    name: "Yiota M.",
    joined: "Since Nov 2023",
    phone: "+357 96 901 234",
    visitText: "Wed, 13 May · 10:00",
    visitSub: "Next booking",
    isNext: true,
    visits: 12,
    spent: "€960",
    tag: "Regular",
    tagBg: "bg-neutral-100",
    tagColor: "text-neutral-600",
    avatarBg: "bg-[#FAEEDA]",
    avatarText: "YM"
  },
  {
    name: "Maria K.",
    joined: "Since Feb 2024",
    phone: "+357 96 567 444",
    visitText: "Thu, 14 May · 11:30",
    visitSub: "Next booking",
    isNext: true,
    visits: 4,
    spent: "€320",
    tag: "VIP",
    tagBg: "bg-[#FAEEDA]",
    tagColor: "text-[#633806]",
    avatarBg: "bg-[#E6F1FB]",
    avatarText: "MK"
  },
  {
    name: "Christos T.",
    joined: "Since Sep 2023",
    phone: "+357 99 345 678",
    visitText: "Fri, 15 May · 14:00",
    visitSub: "Last visit",
    isNext: false,
    visits: 24,
    spent: "€2,160",
    tag: "VIP",
    tagBg: "bg-[#FAEEDA]",
    tagColor: "text-[#633806]",
    avatarBg: "bg-[#E1F5EE]",
    avatarText: "CT"
  },
  {
    name: "Eleni P.",
    joined: "Since Apr 2024",
    phone: "+357 96 789 012",
    visitText: "Sat, 16 May · 16:30",
    visitSub: "Last visit",
    isNext: false,
    visits: 3,
    spent: "€150",
    tag: "New",
    tagBg: "bg-[#E6F1FB]",
    tagColor: "text-[#0C447C]",
    avatarBg: "bg-[#FCE4E4]",
    avatarText: "EP"
  },
  {
    name: "Andreas S.",
    joined: "Since Dec 2023",
    phone: "+357 96 345 222",
    visitText: "Sun, 17 May · 10:00",
    visitSub: "Next booking",
    isNext: true,
    visits: 9,
    spent: "€720",
    tag: "Regular",
    tagBg: "bg-neutral-100",
    tagColor: "text-neutral-600",
    avatarBg: "bg-[#E6F1FB]",
    avatarText: "AS"
  },
  {
    name: "Nikos G.",
    joined: "Since May 2024",
    phone: "+357 96 789 666",
    visitText: "Mon, 18 May · 12:00",
    visitSub: "Next booking",
    isNext: true,
    visits: 2,
    spent: "€160",
    tag: "New",
    tagBg: "bg-[#E6F1FB]",
    tagColor: "text-[#0C447C]",
    avatarBg: "bg-[#EEEDFE]",
    avatarText: "NG"
  },
  {
    name: "Anna M.",
    joined: "Since Mar 2024",
    phone: "+357 96 234 111",
    visitText: "Tue, 19 May · 15:00",
    visitSub: "Last visit",
    isNext: false,
    visits: 7,
    spent: "€490",
    tag: "Regular",
    tagBg: "bg-neutral-100",
    tagColor: "text-neutral-600",
    avatarBg: "bg-[#FCE4E4]",
    avatarText: "AM"
  },
  {
    name: "Lydia K.",
    joined: "Since Jan 2024",
    phone: "+357 99 678 555",
    visitText: "10 Jun 2026",
    visitSub: "Last visit",
    isNext: false,
    visits: 14,
    spent: "€1,120",
    tag: "VIP",
    tagBg: "bg-[#FAEEDA]",
    tagColor: "text-[#633806]",
    avatarBg: "bg-[#EEEDFE]",
    avatarText: "LK"
  },
  {
    name: "Rania M.",
    joined: "Since Aug 2024",
    phone: "+357 96 678 555",
    visitText: "Fri, 15 May · 15:30",
    visitSub: "Next booking",
    isNext: true,
    visits: 6,
    spent: "€180",
    tag: "Regular",
    tagBg: "bg-neutral-100",
    tagColor: "text-neutral-600",
    avatarBg: "bg-[#EEEDFE]",
    avatarText: "RM"
  }
];

export const initialScheduleData = [
  {
    time: "09:00 PM",
    name: "Maria K.",
    service: "Hair colour - 60 min",
    payment: "$100",
    platformFee: "$20",
    remainingFee: "$80",
    staff: "Anna",
    lead: "New customer",
  },
  {
    time: "09:00 PM",
    name: "Maria K.",
    service: "Hair colour - 60 min",
    payment: "$100",
    platformFee: "0",
    remainingFee: "$100",
    staff: "George",
    lead: "Returning",
  },
  {
    time: "09:00 PM",
    name: "Maria K.",
    service: "Hair colour - 60 min",
    payment: "$100",
    platformFee: "0",
    remainingFee: "$100",
    staff: "George",
    lead: "Returning",
  },
  {
    time: "09:00 PM",
    name: "Maria K.",
    service: "Hair colour - 60 min",
    payment: "$100",
    platformFee: "$20",
    remainingFee: "$20",
    staff: "George",
    lead: "Returning",
  }
];

export const initialTimelineEvents = [
  { time: "10:30", name: "Maria K.", detail: "Lash Extensions - Elena", duration: "120 min - Return client" },
  { time: "14:00", name: "Sofia C.", detail: "Bridal Make-up - Elena", duration: "Strovolos - First booking" },
  { time: "16:30", name: "Anna N.", detail: "Manicure & Gel - Elena", duration: "Limassol - +€15 travel" }
];

export const initialActivityFeed = [
  {
    id: 1,
    type: "booking",
    text: "New client booked — Maria K. - Hair colour. Deposit €20 collected.",
    time: "2 min ago",
    icon: StarIcon,
    bg: "bg-[#E1F5EE]",
    color: "text-[#085041]"
  },
  {
    id: 2,
    type: "confirm",
    text: "Nikos P. confirmed for tomorrow at 10:30.",
    time: "1 hr ago",
    icon: CalendarCheckIcon,
    bg: "bg-blue-50",
    color: "text-blue-600"
  },
  {
    id: 3,
    type: "payout",
    text: "SEPA payout received — €210 for May no-show fees.",
    time: "Yesterday",
    icon: ReceiptTextIcon,
    bg: "bg-amber-50",
    color: "text-amber-600"
  },
  {
    id: 4,
    type: "cancel",
    text: "Elena S. cancelled. €18 deposit refunded automatically.",
    time: "2 days ago",
    icon: Cancel01Icon,
    bg: "bg-red-50",
    color: "text-red-600"
  }
];
