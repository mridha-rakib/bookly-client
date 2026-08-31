"use client";

import React from "react";
import type { StaticPageAdminItem, StaticPageKey } from "@/lib/api/content";
import { formatStaticPageDate } from "@/lib/content/static-pages";

interface StaticPagesTabProps {
  pages: StaticPageAdminItem[];
  isLoading: boolean;
  isError: boolean;
  onEdit: (pageKey: StaticPageKey) => void;
}

export default function StaticPagesTab({ pages, isLoading, isError, onEdit }: StaticPagesTabProps) {
  return (
    <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-x-auto no-scrollbar">
      <table className="w-full text-left border-collapse text-sm min-w-[700px]">
        <thead>
          <tr className="bg-[#F9FAFB] border-b-[1.06667px] border-b-[#E5E7EB] text-xs font-semibold text-[#374151] h-[36.53px]">
            <th className="px-4 py-2.5 pl-6 font-semibold w-1/2">Page</th>
            <th className="px-4 py-2.5 font-semibold w-1/4">Last Edited</th>
            <th className="px-4 py-2.5 font-semibold text-center pr-6 w-1/4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E7EB] text-gray-700">
          {isLoading && (
            <tr>
              <td colSpan={3} className="px-6 py-10 text-center text-sm text-gray-400">
                Loading pages…
              </td>
            </tr>
          )}
          {!isLoading && isError && (
            <tr>
              <td colSpan={3} className="px-6 py-10 text-center text-sm text-red-500">
                Could not load static pages. Please try again.
              </td>
            </tr>
          )}
          {!isLoading &&
            !isError &&
            pages.map((page) => (
              <tr key={page.pageKey} className="hover:bg-gray-50/50 h-[63.07px]">
                <td className="px-4 py-3 pl-6 font-medium text-sm text-[#111827]">
                  <div className="flex items-center gap-2">
                    {page.title}
                    <span className="text-[11px] font-normal text-[#9CA3AF]">{page.routePath}</span>
                    {!page.exists && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                        Not created yet
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">
                  {formatStaticPageDate(page.updatedAt)}
                </td>
                <td className="px-4 py-3 text-right pr-6">
                  <div className="flex items-center justify-end pr-2">
                    <button
                      onClick={() => onEdit(page.pageKey)}
                      className="h-[36px] w-[57.7px] flex items-center justify-center text-[13px] font-medium text-[#6366F1] bg-white border border-[#6366F1] rounded-full hover:bg-indigo-50 transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
