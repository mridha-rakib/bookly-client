"use client";

import Image from "next/image";
import React, { useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft02Icon,
  Tag01Icon,
  TickDouble02Icon,
  ImageAddIcon,
  LinkIcon,
  StarIcon,
  Facebook02Icon,
  InstagramIcon,
} from "@hugeicons/core-free-icons";

import type { BlogAdminPost, BlogCategory, BlogStatus } from "@/lib/api/content";
import { useUploadBlogMediaMutation } from "@/lib/content/hooks";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import { BLOG_CATEGORIES, blogCategoryLabel } from "@/lib/content/blog";

export interface BlogFormPayload {
  title: string;
  bodyHtml: string;
  category: BlogCategory;
  status: BlogStatus;
  coverMediaId: string | null;
  galleryMediaIds: string[];
  facebookUrl: string | null;
  instagramUrl: string | null;
}

interface NewBlogPostPageProps {
  editingPost: BlogAdminPost | null;
  isSaving: boolean;
  onDiscard: () => void;
  onSave: (data: BlogFormPayload) => void;
}

interface EditorImage {
  mediaId: string;
  url: string;
  role: "cover" | "gallery";
}

const CATEGORY_META: Record<BlogCategory, { sub: string; bg: string; text: string }> = {
  FOUNDING_PARTNER: { sub: "Business spotlight stories", bg: "rgba(245, 197, 24, 0.15)", text: "#92400E" },
  BOOKLY_NEWS: { sub: "Platform updates & announcements", bg: "rgba(37, 99, 235, 0.1)", text: "#1D4ED8" },
  FOR_BUSINESS: { sub: "Guides for business owners", bg: "rgba(37, 99, 235, 0.1)", text: "#1D4ED8" },
  CUSTOMER_TIPS: { sub: "Advice for customers", bg: "rgba(37, 99, 235, 0.1)", text: "#1D4ED8" },
};

export default function NewBlogPostPage({
  editingPost,
  isSaving,
  onDiscard,
  onSave,
}: NewBlogPostPageProps) {
  const [title, setTitle] = useState(editingPost?.title ?? "");
  const [category, setCategory] = useState<BlogCategory>(editingPost?.category ?? "FOUNDING_PARTNER");
  const [status, setStatus] = useState<BlogStatus>(editingPost?.status ?? "DRAFT");
  const [fbLink, setFbLink] = useState(editingPost?.facebookUrl ?? "");
  const [igLink, setIgLink] = useState(editingPost?.instagramUrl ?? "");
  const [images, setImages] = useState<EditorImage[]>(() => [
    ...(editingPost?.coverImage
      ? [{ mediaId: editingPost.coverImage.id, url: editingPost.coverImage.url, role: "cover" as const }]
      : []),
    ...(editingPost?.galleryImages ?? []).map((img) => ({
      mediaId: img.id,
      url: img.url,
      role: "gallery" as const,
    })),
  ]);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [warning, setWarning] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedSelectionRange = useRef<Range | null>(null);
  const editorSeeded = useRef(false);

  const uploadMedia = useUploadBlogMediaMutation();

  // Seed the contentEditable once (it is uncontrolled — never re-inject on every render).
  const setEditorRef = (node: HTMLDivElement | null) => {
    editorRef.current = node;
    if (node && !editorSeeded.current) {
      node.innerHTML = editingPost?.bodyHtml ?? "";
      editorSeeded.current = true;
    }
  };

  const uploadFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      try {
        const media = await uploadMedia.mutateAsync(file);
        setImages((prev) => {
          const hasCover = prev.some((img) => img.role === "cover");
          return [...prev, { mediaId: media.id, url: media.url, role: hasCover ? "gallery" : "cover" }];
        });
      } catch (error) {
        toast.error(toUserMessage(error));
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void uploadFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
  };

  const removeImage = (mediaId: string) => {
    setImages((prev) => {
      const next = prev.filter((img) => img.mediaId !== mediaId);
      // If we removed the cover, promote the first remaining image.
      if (!next.some((img) => img.role === "cover") && next[0]) {
        next[0] = { ...next[0], role: "cover" };
      }
      return next;
    });
  };

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

  const submit = (nextStatus: BlogStatus) => {
    const bodyHtml = editorRef.current?.innerHTML ?? "";
    if (!title.trim() || !editorRef.current?.textContent?.trim()) {
      setWarning("Please enter a title and some content.");
      return;
    }
    setStatus(nextStatus);
    const cover = images.find((img) => img.role === "cover");
    onSave({
      title: title.trim(),
      bodyHtml,
      category,
      status: nextStatus,
      coverMediaId: cover ? cover.mediaId : null,
      galleryMediaIds: images.filter((img) => img.role === "gallery").map((img) => img.mediaId),
      facebookUrl: fbLink.trim() || null,
      instagramUrl: igLink.trim() || null,
    });
  };

  return (
    <div className="flex flex-col gap-6 font-sans w-full max-w-none h-full overflow-y-auto no-scrollbar pb-10">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .editor-content:empty:before {
          content: "Write your blog post content in English...";
          color: #757575;
        }
        .editor-content ul { list-style-type: disc !important; margin-left: 1.5rem !important; padding-left: 0.5rem !important; }
        .editor-content ol { list-style-type: decimal !important; margin-left: 1.5rem !important; padding-left: 0.5rem !important; }
        .editor-content a { color: #6366F1 !important; text-decoration: underline !important; font-weight: 500; }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0 w-full">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <button
              onClick={onDiscard}
              className="flex items-center gap-1 hover:text-[#6366F1] bg-transparent border-none cursor-pointer"
            >
              <HugeiconsIcon icon={ArrowLeft02Icon} className="w-3.5 h-3.5" />
              <span>Content Manager</span>
            </button>
            <span>›</span>
            <span>{editingPost ? "Edit Post" : "New Post"}</span>
          </div>
          <h1 className="text-2xl font-bold text-[#111827] leading-9">
            {editingPost ? "Edit Blog Post" : "New Blog Post"}
          </h1>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-semibold text-[#6366F1] hover:underline bg-transparent border-none cursor-pointer disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => submit("DRAFT")}
            disabled={isSaving}
            className="px-5 py-2.5 text-sm font-semibold text-[#6366F1] bg-white border border-[#6366F1] rounded-full hover:bg-indigo-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            type="button"
            onClick={() => submit("PUBLISHED")}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#6366F1] hover:bg-indigo-600 rounded-full transition-colors cursor-pointer border-none shadow-sm disabled:opacity-60"
          >
            <HugeiconsIcon icon={TickDouble02Icon} className="w-[18px] h-[18px]" />
            <span>{isSaving ? "Saving…" : "Publish"}</span>
          </button>
        </div>
      </div>

      {/* Body grid */}
      <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
        <div className="flex-grow flex flex-col gap-5 w-full lg:max-w-none">
          <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6 flex flex-col gap-1.5 w-full">
            <label className="text-xs font-semibold text-[#374151] leading-4">Post Title — English (EN)</label>
            <input
              type="text"
              placeholder="Enter post title in English..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 h-11 text-base font-semibold text-gray-800 placeholder-[#6B7280] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
            />
          </div>

          <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6 flex flex-col gap-3 w-full">
            <div className="flex items-center gap-2 h-5">
              <div className="flex items-center justify-center bg-[#F0F9FF] rounded px-1.5 py-0.5 shrink-0 select-none">
                <span className="text-[10px] font-bold text-[#0369A1] leading-3">EN</span>
              </div>
              <span className="text-xs font-semibold text-[#374151] leading-4">Content — English</span>
            </div>

            <div className="w-full border border-[#E5E7EB] rounded-lg overflow-hidden flex flex-col min-h-[300px]">
              <div className="flex flex-wrap items-center gap-1 bg-[#F9FAFB] border-b border-[#E5E7EB] p-2 shrink-0">
                {(
                  [
                    ["bold", "B", "font-bold"],
                    ["italic", "I", "italic font-serif"],
                    ["underline", "U", "underline"],
                  ] as const
                ).map(([cmd, label, cls]) => (
                  <button
                    key={cmd}
                    type="button"
                    onClick={() => execCommand(cmd)}
                    className={`px-2.5 py-1 text-xs text-[#374151] bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded cursor-pointer ${cls}`}
                  >
                    {label}
                  </button>
                ))}
                <div className="w-[1px] h-5 bg-[#E5E7EB] mx-1 shrink-0" />
                {(["H1", "H2", "H3"] as const).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => execCommand("formatBlock", h)}
                    className="px-2.5 py-1 text-xs font-bold text-[#374151] bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded cursor-pointer"
                  >
                    {h}
                  </button>
                ))}
                <div className="w-[1px] h-5 bg-[#E5E7EB] mx-1 shrink-0" />
                <button
                  type="button"
                  onClick={() => execCommand("insertUnorderedList")}
                  className="px-2 py-1 text-xs text-[#374151] bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded cursor-pointer"
                >
                  • List
                </button>
                <button
                  type="button"
                  onClick={() => execCommand("insertOrderedList")}
                  className="px-2 py-1 text-xs text-[#374151] bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded cursor-pointer"
                >
                  1. List
                </button>
                <div className="w-[1px] h-5 bg-[#E5E7EB] mx-1 shrink-0" />
                <button
                  type="button"
                  onClick={handleLink}
                  className="px-2.5 py-1 text-xs text-[#374151] bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded cursor-pointer"
                >
                  🔗 Link
                </button>
                <button
                  type="button"
                  onClick={() => execCommand("formatBlock", "blockquote")}
                  className="px-2.5 py-1 text-xs text-[#374151] bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded cursor-pointer"
                >
                  ❝ Quote
                </button>
                <button
                  type="button"
                  onClick={() => execCommand("insertHorizontalRule")}
                  className="px-2.5 py-1 text-xs text-[#374151] bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded cursor-pointer"
                >
                  — Divider
                </button>
              </div>

              <div
                ref={setEditorRef}
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
                className="editor-content p-4 flex-grow text-[15px] font-normal leading-[26px] text-gray-800 focus:outline-none min-h-[220px]"
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-5 w-full lg:w-[320px] shrink-0">
          <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-5 flex flex-col gap-3.5 w-full">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Tag01Icon} className="w-3.5 h-3.5 text-gray-700" />
              <span className="text-xs font-semibold text-[#111827] leading-4">Blog Type</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {BLOG_CATEGORIES.map((value) => {
                const meta = CATEGORY_META[value];
                const isSelected = category === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value)}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border text-left cursor-pointer transition-colors w-full ${
                      isSelected ? "border-[#6366F1] bg-[#6366F1]/5" : "border-[#E5E7EB] bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: meta.bg }}
                    >
                      <HugeiconsIcon icon={StarIcon} className="w-4 h-4" style={{ color: meta.text }} />
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs font-semibold text-[#111827] leading-4">
                        {blogCategoryLabel(value)}
                      </span>
                      <span className="text-[11px] font-normal text-[#6B7280] leading-3 truncate">
                        {meta.sub}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-5 flex flex-col gap-3.5 w-full">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={TickDouble02Icon} className="w-3.5 h-3.5 text-gray-700" />
              <span className="text-xs font-semibold text-[#111827] leading-4">Status</span>
            </div>
            <div className="flex flex-col gap-2">
              {(
                [
                  ["DRAFT", "Draft", "Saved but not visible on the site", "#6B7280"],
                  ["PUBLISHED", "Published", "Visible on the public blog", "#16A34A"],
                ] as const
              ).map(([value, label, sub, color]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left cursor-pointer transition-colors w-full ${
                    status === value ? "border-[#6366F1] bg-[#6366F1]/5" : "border-[#E5E7EB] bg-white hover:bg-gray-55"
                  }`}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-semibold text-[#111827] leading-4">{label}</span>
                    <span className="text-[11px] font-normal text-[#6B7280] leading-3 truncate">{sub}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-5 flex flex-col gap-3.5 w-full">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={ImageAddIcon} className="w-3.5 h-3.5 text-gray-700" />
              <span className="text-xs font-semibold text-[#111827] leading-4">Media</span>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="w-full h-[109px] bg-[#F9FAFB] border border-dashed border-[#E5E7EB] rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:bg-gray-50/50 transition-colors"
            >
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <HugeiconsIcon icon={ImageAddIcon} className="w-6 h-6 text-gray-500" />
              <span className="text-xs font-semibold text-[#374151] leading-4">
                {uploadMedia.isPending ? "Uploading…" : "Upload images"}
              </span>
              <span className="text-[11px] text-[#6B7280] leading-3">Drop here or click · PNG, JPG, WebP</span>
            </div>

            <div className="flex items-center gap-2 w-full flex-wrap">
              {images.map((img) => (
                <div
                  key={img.mediaId}
                  className="relative w-[88px] h-[66px] rounded-lg overflow-hidden shrink-0 border border-gray-150"
                >
                  <Image src={img.url} alt="" fill className="object-cover" unoptimized />
                  {img.role === "cover" && (
                    <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">
                      Cover
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(img.mediaId)}
                    className="absolute top-1 right-1 w-4 h-4 bg-black/55 hover:bg-black/80 rounded-full flex items-center justify-center text-white text-[9px] cursor-pointer border-none"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <span className="text-[11px] font-normal text-[#6B7280] leading-3">
              First image = cover photo. Multiple allowed.
            </span>
          </div>

          <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-5 flex flex-col gap-3.5 w-full">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={LinkIcon} className="w-3.5 h-3.5 text-gray-700" />
              <span className="text-xs font-semibold text-[#111827] leading-4">Social Links</span>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={Facebook02Icon} className="w-3.5 h-3.5 text-[#1877F2]" />
                  <label className="text-xs font-semibold text-[#374151] leading-4">Facebook Post URL</label>
                </div>
                <input
                  type="url"
                  placeholder="https://facebook.com/..."
                  value={fbLink}
                  onChange={(e) => setFbLink(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 h-11 text-xs font-medium text-gray-800 placeholder-[#6B7280] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                />
              </div>
              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={InstagramIcon} className="w-3.5 h-3.5 text-[#E1306C]" />
                  <label className="text-xs font-semibold text-[#374151] leading-4">Instagram Post URL</label>
                </div>
                <input
                  type="url"
                  placeholder="https://instagram.com/..."
                  value={igLink}
                  onChange={(e) => setIgLink(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 h-11 text-xs font-medium text-gray-800 placeholder-[#6B7280] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

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
