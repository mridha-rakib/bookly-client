"use client";

import React, { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon, LinkIcon, TickDouble02Icon } from "@hugeicons/core-free-icons";

import type { StaticPageKey } from "@/lib/api/content";
import { useAdminStaticPageQuery, useUpdateStaticPageMutation } from "@/lib/content/hooks";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import { formatStaticPageDate } from "@/lib/content/static-pages";

interface StaticPageEditorPageProps {
  pageKey: StaticPageKey;
  onDiscard: () => void;
  onSaved: () => void;
}

export default function StaticPageEditorPage({
  pageKey,
  onDiscard,
  onSaved,
}: StaticPageEditorPageProps) {
  const pageQuery = useAdminStaticPageQuery(pageKey);
  const updateMutation = useUpdateStaticPageMutation();

  const [title, setTitle] = useState("");
  const [titleSeeded, setTitleSeeded] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [warning, setWarning] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const savedSelectionRange = useRef<Range | null>(null);
  const editorSeeded = useRef(false);

  const data = pageQuery.data;

  // Seed the title once from the fetched record (state, adjusted during render — the React
  // "reset state when a prop changes" pattern). `pageKey` is fixed for this component's life.
  if (data && !titleSeeded) {
    setTitleSeeded(true);
    setTitle(data.title);
  }

  // Seed the uncontrolled contentEditable once, after data has arrived and the node is mounted.
  useEffect(() => {
    if (data && editorRef.current && !editorSeeded.current) {
      editorRef.current.innerHTML = data.bodyHtml;
      editorSeeded.current = true;
    }
  }, [data]);

  const execCommand = (command: string, value = "") => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleLink = () => {
    const selection = window.getSelection();
    savedSelectionRange.current =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    setLinkUrl("");
    setShowLinkModal(true);
  };

  const handleSaveLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (linkUrl && editorRef.current) {
      editorRef.current.focus();
      if (savedSelectionRange.current) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(savedSelectionRange.current);
      }
      execCommand("createLink", linkUrl);
      for (const anchor of Array.from(editorRef.current.getElementsByTagName("a"))) {
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noopener noreferrer");
      }
    }
    setShowLinkModal(false);
  };

  const handleSave = async () => {
    const bodyHtml = editorRef.current?.innerHTML ?? "";
    if (!title.trim() || !editorRef.current?.textContent?.trim()) {
      setWarning("Please enter a page title and some content.");
      return;
    }
    try {
      await updateMutation.mutateAsync({ pageKey, input: { title: title.trim(), bodyHtml } });
      toast.success("Page updated successfully.");
      onSaved();
    } catch (error) {
      // Stay on the editor with the user's content intact.
      toast.error(toUserMessage(error));
    }
  };

  const toolbarBtn =
    "w-7 h-7 flex items-center justify-center text-xs rounded-md cursor-pointer transition-colors text-[#374151] bg-white border border-[#E5E7EB] hover:bg-gray-50";

  return (
    <div className="flex flex-col gap-6 font-sans w-full max-w-none h-full overflow-y-auto no-scrollbar pb-10">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .editor-content ul { list-style-type: disc !important; margin-left: 1.5rem !important; padding-left: 0.5rem !important; margin-bottom: 1rem !important; }
        .editor-content ol { list-style-type: decimal !important; margin-left: 1.5rem !important; padding-left: 0.5rem !important; margin-bottom: 1rem !important; }
        .editor-content h1 { font-size: 28px !important; font-weight: 700 !important; margin: 1.5rem 0 1rem !important; color: #111827 !important; }
        .editor-content h2 { font-size: 24px !important; font-weight: 700 !important; margin: 1.5rem 0 1rem !important; color: #111827 !important; }
        .editor-content h3 { font-size: 18px !important; font-weight: 700 !important; margin: 1.25rem 0 0.75rem !important; color: #111827 !important; }
        .editor-content p { font-size: 15px !important; line-height: 1.75 !important; color: #374151 !important; }
        .editor-content a { color: #6366F1 !important; text-decoration: underline !important; }
      `}</style>

      {/* Breadcrumb + actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 flex-shrink-0 w-full">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <button
              onClick={onDiscard}
              className="flex items-center gap-1 hover:text-[#6366F1] bg-transparent border-none cursor-pointer"
            >
              <span>Content Manager</span>
            </button>
            <span className="text-[#E5E7EB]">›</span>
            <span className="text-[#6B7280]">Static Pages</span>
            <span className="text-[#E5E7EB]">›</span>
            <span className="text-[#6B7280]">{title || (data?.title ?? "")}</span>
          </div>
          <h1 className="text-[32px] font-bold text-[#111827] leading-[38px] tracking-tight mt-1">
            {title || (data?.title ?? "Static Page")}
          </h1>
          {data && (
            <span className="text-xs text-[#6B7280] mt-0.5">
              {data.exists
                ? `Last updated ${formatStaticPageDate(data.updatedAt)}`
                : "Not published yet — saving will publish this page"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onDiscard}
            disabled={updateMutation.isPending}
            className="px-4 py-2 text-sm font-semibold text-[#6366F1] hover:underline bg-transparent border-none cursor-pointer disabled:opacity-50"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending || pageQuery.isLoading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#6366F1] hover:bg-indigo-600 rounded-full transition-colors cursor-pointer border-none shadow-sm disabled:opacity-60"
          >
            <HugeiconsIcon icon={TickDouble02Icon} className="w-[18px] h-[18px]" />
            <span>{updateMutation.isPending ? "Saving…" : "Save"}</span>
          </button>
        </div>
      </div>

      {pageQuery.isLoading && (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-sm text-gray-400">
          Loading page…
        </div>
      )}
      {!pageQuery.isLoading && pageQuery.isError && (
        <div className="bg-white rounded-xl border border-red-100 p-10 text-center text-sm text-red-500">
          Could not load this page. Please go back and try again.
        </div>
      )}

      {!pageQuery.isLoading && !pageQuery.isError && (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
          {/* Editor */}
          <div className="flex-grow flex flex-col w-full lg:max-w-none bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden h-[660px]">
            <div className="flex flex-wrap items-center justify-between gap-1 bg-[#F9FAFB] border-b border-[#E5E7EB] p-2.5 shrink-0">
              <div className="flex flex-wrap items-center gap-1">
                <select
                  onChange={(e) => execCommand("formatBlock", e.target.value)}
                  className="appearance-none bg-white border border-[#E5E7EB] rounded-md px-2 py-1 text-xs font-medium text-gray-700 cursor-pointer focus:outline-none pr-6"
                  defaultValue="p"
                >
                  <option value="p">Paragraph</option>
                  <option value="H2">Heading 1</option>
                  <option value="H3">Heading 2</option>
                </select>
                <div className="w-[1px] h-5 bg-[#E5E7EB] mx-1 shrink-0" />
                <button type="button" onClick={() => execCommand("bold")} className={`${toolbarBtn} font-bold`}>B</button>
                <button type="button" onClick={() => execCommand("italic")} className={`${toolbarBtn} font-serif italic`}>I</button>
                <button type="button" onClick={() => execCommand("underline")} className={`${toolbarBtn} underline`}>U</button>
                <button type="button" onClick={() => execCommand("strikeThrough")} className={`${toolbarBtn} line-through`}>S</button>
                <div className="w-[1px] h-5 bg-[#E5E7EB] mx-1 shrink-0" />
                <button type="button" onClick={() => execCommand("justifyLeft")} className={toolbarBtn} title="Align left">⯇</button>
                <button type="button" onClick={() => execCommand("justifyCenter")} className={toolbarBtn} title="Align center">≡</button>
                <button type="button" onClick={() => execCommand("justifyRight")} className={toolbarBtn} title="Align right">⯈</button>
                <div className="w-[1px] h-5 bg-[#E5E7EB] mx-1 shrink-0" />
                <button type="button" onClick={() => execCommand("insertUnorderedList")} className={toolbarBtn} title="Bullet list">•</button>
                <button type="button" onClick={() => execCommand("insertOrderedList")} className={toolbarBtn} title="Numbered list">1.</button>
                <div className="w-[1px] h-5 bg-[#E5E7EB] mx-1 shrink-0" />
                <button type="button" onClick={handleLink} className={toolbarBtn} title="Link">🔗</button>
                <button type="button" onClick={() => execCommand("formatBlock", "blockquote")} className={toolbarBtn} title="Quote">❝</button>
                <button type="button" onClick={() => execCommand("insertHorizontalRule")} className={toolbarBtn} title="Divider">―</button>
                <div className="w-[1px] h-5 bg-[#E5E7EB] mx-1 shrink-0" />
                <button type="button" onClick={() => execCommand("undo")} className={toolbarBtn} title="Undo">↺</button>
                <button type="button" onClick={() => execCommand("redo")} className={toolbarBtn} title="Redo">↻</button>
              </div>
            </div>

            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.tagName === "A") {
                  e.preventDefault();
                  const href = target.getAttribute("href");
                  if (href) window.open(href, "_blank", "noopener,noreferrer");
                }
              }}
              className="editor-content p-8 flex-grow h-[550px] overflow-y-auto text-gray-800 focus:outline-none"
            />
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4 w-full lg:w-[280px] shrink-0">
            <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-5 flex flex-col gap-3.5 w-full">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={InformationCircleIcon} className="w-3.5 h-3.5 text-gray-700" />
                <span className="text-xs font-semibold text-[#111827] leading-4">Page Info</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-[#6B7280]">Page title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 h-9 text-xs font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                />
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#6B7280]">Last updated</span>
                <span className="text-gray-700">
                  {data ? formatStaticPageDate(data.updatedAt) : "—"}
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-5 flex flex-col gap-3 w-full">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={LinkIcon} className="w-3.5 h-3.5 text-gray-700" />
                <span className="text-xs font-semibold text-[#111827] leading-4">Public URL</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[#6B7280]">bookly.cy</span>
                <span className="font-medium text-gray-800">{data?.routePath}</span>
              </div>
              <span className="text-[10px] text-[#6B7280] leading-3">
                Fixed system page — the URL cannot be changed here.
              </span>
            </div>
          </div>
        </div>
      )}

      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-[400px] rounded-xl overflow-hidden shadow-xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center shrink-0">
              <h3 className="font-bold text-base text-[#111827]">Insert Link</h3>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveLink} className="flex flex-col gap-4">
              <input
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-600 border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-full bg-[#6366F1] hover:bg-indigo-650 text-xs font-semibold text-white border-none cursor-pointer"
                >
                  Insert Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {warning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-[380px] rounded-xl overflow-hidden shadow-xl p-6 flex flex-col gap-4">
            <h3 className="font-bold text-base text-[#111827]">Validation Error</h3>
            <p className="text-sm text-gray-600 leading-5">{warning}</p>
            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setWarning(null)}
                className="px-5 py-2 rounded-full bg-[#6366F1] hover:bg-indigo-650 text-xs font-semibold text-white border-none cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
