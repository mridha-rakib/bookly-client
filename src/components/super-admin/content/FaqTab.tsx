"use client";

import React, { useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Faq } from "@/lib/api/content";

interface FaqTabProps {
  faqs: Faq[];
  isLoading: boolean;
  isError: boolean;
  isReordering: boolean;
  onReorder: (orderedIds: string[]) => void;
  onEdit: (faq: Faq) => void;
  onDelete: (id: string) => void;
  onNewFaq: () => void;
}

interface SortableFaqRowProps {
  faq: Faq;
  disabled: boolean;
  onEdit: (faq: Faq) => void;
  onDelete: (id: string) => void;
}

function SortableFaqRow({ faq, disabled, onEdit, onDelete }: SortableFaqRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: faq.id,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white hover:bg-gray-55 border border-[#E5E7EB] rounded-lg p-3.5 px-4 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] flex flex-row items-center gap-3 w-full"
    >
      {/* Drag handle — the grip glyph is now the real, keyboard-operable drag handle. */}
      <button
        type="button"
        aria-label={`Reorder FAQ: ${faq.question}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
        className="text-[#6B7280] font-normal text-lg select-none flex-shrink-0 flex items-center justify-center w-[13px] h-[22px] bg-transparent border-none p-0 cursor-grab active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40 touch-none"
      >
        ⠿
      </button>

      {/* FAQ Details column */}
      <div className="flex-grow flex flex-col gap-0.5 min-w-0">
        <h3 className="font-semibold text-[#111827] text-sm leading-[17px] truncate flex items-center gap-2" title={faq.question}>
          {faq.status === "DRAFT" && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">
              Draft
            </span>
          )}
          <span className="truncate">{faq.question}</span>
        </h3>
        <p
          className="text-[13px] font-normal text-[#6B7280] leading-[16px] truncate"
          title={faq.answer}
        >
          {faq.answer}
        </p>
      </div>

      {/* Edit & Delete Action row */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onEdit(faq)}
          className="text-[13px] font-medium text-[#6366F1] hover:underline bg-transparent border-none cursor-pointer px-2.5 py-1"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(faq.id)}
          className="text-[13px] font-medium text-[#DC2626] hover:underline bg-transparent border-none cursor-pointer px-2.5 py-1"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function FaqTab({
  faqs,
  isLoading,
  isError,
  isReordering,
  onReorder,
  onEdit,
  onDelete,
  onNewFaq,
}: FaqTabProps) {
  // Optimistic local order for smooth drag/drop. Re-synced from `faqs` whenever the server list
  // reference changes (React Query returns a new array on a real refetch, the same one when
  // structurally unchanged) — the "adjust state during render" pattern, no effect.
  const [items, setItems] = useState<Faq[]>(faqs);
  const [syncedFrom, setSyncedFrom] = useState<Faq[]>(faqs);
  if (faqs !== syncedFrom) {
    setSyncedFrom(faqs);
    setItems(faqs);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((f) => f.id === active.id);
    const newIndex = items.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next); // optimistic; parent refetch reconciles (and restores on failure)
    onReorder(next.map((f) => f.id));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header toolbar with Add FAQ button */}
      <div className="flex justify-end w-full">
        <button
          onClick={onNewFaq}
          className="flex items-center gap-1.5 h-9 px-4 bg-[#6366F1] text-white text-[13px] font-medium rounded-full hover:bg-indigo-650 transition-colors border-none cursor-pointer"
        >
          + Add FAQ
        </button>
      </div>

      {/* List items block */}
      <div className="flex flex-col gap-2">
        {isLoading && (
          <div className="text-center py-10 bg-white border border-[#E5E7EB] rounded-lg text-gray-400 text-sm">
            Loading FAQs…
          </div>
        )}

        {!isLoading && isError && (
          <div className="text-center py-10 bg-white border border-red-100 rounded-lg text-red-500 text-sm">
            Could not load FAQs. Please try again.
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="text-center py-10 bg-white border border-[#E5E7EB] rounded-lg text-gray-400 text-sm">
            No FAQs yet. Click “+ Add FAQ” to create the first one.
          </div>
        )}

        {!isLoading && !isError && items.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {items.map((faq) => (
                  <SortableFaqRow
                    key={faq.id}
                    faq={faq}
                    disabled={isReordering}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
