import React from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

interface SubTabItem {
  name: string;
  icon: IconSvgElement;
}

interface SettingsSubSidebarProps {
  tabs: SubTabItem[];
  activeSubTab: string;
  setActiveSubTab: (name: string) => void;
}

export const SettingsSubSidebar: React.FC<SettingsSubSidebarProps> = ({
  tabs,
  activeSubTab,
  setActiveSubTab
}) => (
  <div className="w-full lg:w-[240px] shrink-0 bg-white rounded-[16px] p-4 flex flex-col gap-1 shadow-none">
    {tabs.map((tab) => {
      const isActive = activeSubTab === tab.name;
      return (
        <button
          key={tab.name}
          onClick={() => setActiveSubTab(tab.name)}
          className={`w-full flex items-start text-left gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
            isActive ? "bg-[#B0C5C8]/40 text-[#111111]" : "text-[#666666] hover:bg-neutral-50"
          }`}
        >
          <HugeiconsIcon icon={tab.icon} className="w-5 h-5 shrink-0 mt-0.5" />
          <span className="leading-tight">{tab.name}</span>
        </button>
      );
    })}
  </div>
);
