"use client";

/**
 * HighlightedBlocks Components
 * ============================
 * Components hiển thị các block được highlight khi chọn môn học từ sidebar
 */

import React from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";

import { useScheduleStore } from "@/store/schedule-store";
import type { ClassSection, HighlightedSlot } from "@/types";
import { cn } from "@/lib/utils";

// Constants
const DAYS = [2, 3, 4, 5, 6, 7]; // Thứ 2 - Thứ 7
const CELL_HEIGHT = 48; // px

// ============ Highlighted Blocks Overlay ============

interface HighlightedBlocksOverlayProps {
  highlightedSlots: HighlightedSlot[];
  maxPeriod: number;
  visibleDays: number[];
}

export function HighlightedBlocksOverlay({ highlightedSlots, maxPeriod, visibleDays }: HighlightedBlocksOverlayProps) {
  const { clickSelectedCourse } = useScheduleStore();

  if (highlightedSlots.length === 0) return null;

  // Group sections by their exact slot range (day, start, count)
  // This avoids overlapping blocks and allows showing multiple options in one block
  const blocksByRange = new Map<
    string,
    { dayOfWeek: number; startPeriod: number; periodCount: number; hasConflict: boolean; sections: ClassSection[] }
  >();

  highlightedSlots.forEach((slot) => {
    const { dayOfWeek, period } = slot.slot;

    if (period > maxPeriod) return;

    slot.availableSections.forEach((section: ClassSection) => {
      // We use the section's actual range to group
      const key = `${dayOfWeek}-${section.startPeriod}-${section.periodCount}`;

      if (!blocksByRange.has(key)) {
        blocksByRange.set(key, {
          dayOfWeek,
          startPeriod: section.startPeriod,
          periodCount: section.periodCount,
          hasConflict: false,
          sections: [],
        });
      }

      const block = blocksByRange.get(key)!;
      if (!block.sections.find((s) => s.id === section.id)) {
        block.sections.push(section);
      }
      // If any slot in this range has a conflict for this section, mark it
      if (slot.hasConflict) block.hasConflict = true;
    });
  });

  // Render blocks
  const blockElements: JSX.Element[] = [];
  const isClickMode = clickSelectedCourse !== null;

  blocksByRange.forEach((block, key) => {
    // Desktop: use all days
    const desktopDayIndex = DAYS.indexOf(block.dayOfWeek);
    // Mobile: use visible days
    const mobileDayIndex = visibleDays.indexOf(block.dayOfWeek);

    if (desktopDayIndex === -1) return;

    blockElements.push(
      <ClickableHighlightBlock
        key={key}
        block={block}
        dayIndex={desktopDayIndex}
        mobileDayIndex={mobileDayIndex}
        mobileVisible={mobileDayIndex !== -1}
        mobileDaysCount={visibleDays.length}
        isClickMode={isClickMode}
      />
    );
  });

  return <div className="absolute inset-0 z-10 left-14 sm:left-20">{blockElements}</div>;
}

// ============ Clickable Highlight Block ============

interface ClickableHighlightBlockProps {
  block: {
    dayOfWeek: number;
    startPeriod: number;
    periodCount: number;
    hasConflict: boolean;
    sections: ClassSection[];
  };
  dayIndex: number;
  mobileDayIndex: number;
  mobileVisible: boolean;
  mobileDaysCount: number;
  isClickMode: boolean;
}

function ClickableHighlightBlock({
  block,
  dayIndex,
  mobileDayIndex,
  mobileVisible,
  mobileDaysCount,
  isClickMode,
}: ClickableHighlightBlockProps) {
  const { addClassToSchedule, clickSelectedLecturer } = useScheduleStore();

  // Desktop positioning
  const desktopDayWidth = `calc((100%) / ${DAYS.length})`;
  const desktopLeft = `calc(${dayIndex} * ${desktopDayWidth})`;

  // Mobile positioning
  const mobileDayWidth = `calc((100%) / ${mobileDaysCount})`;
  const mobileLeft = `calc(${mobileDayIndex} * ${mobileDayWidth})`;

  const top = (block.startPeriod - 1) * CELL_HEIGHT;
  const height = block.periodCount * CELL_HEIGHT;

  // Lọc theo giảng viên nếu có chọn ở sidebar
  const filteredSections = clickSelectedLecturer
    ? block.sections.filter((s) => s.lecturer === clickSelectedLecturer)
    : block.sections;

  function handleSelectSection(section: ClassSection): void {
    const result = addClassToSchedule(section);
    if (!result.success) {
      if (result.error) {
        toast.error(result.error);
      } else if (result.conflicts.length > 0) {
        toast.error(`Trùng lịch với: ${result.conflicts[0].conflictingClasses.map((c) => c.courseName).join(", ")}`);
      }
    } else {
      toast.success(`Đã thêm ${section.courseName} vào lịch`);
    }
  }

  function handleClick(): void {
    if (block.hasConflict || !isClickMode) return;
    if (filteredSections.length === 1) {
      handleSelectSection(filteredSections[0]);
    }
  }

  const hasMultipleOptions = filteredSections.length > 1;

  return (
    <>
      {/* Desktop block */}
      <div
        onClick={handleClick}
        className={cn(
          "absolute border-2 rounded-md transition-all z-20 overflow-hidden hidden md:block",
          block.hasConflict
            ? "border-red-400 bg-red-100/50 pointer-events-none"
            : isClickMode
            ? cn(
                "cursor-pointer pointer-events-auto",
                hasMultipleOptions
                  ? "border-green-400 bg-green-50/90 shadow-sm"
                  : "border-green-400 bg-green-100/70 hover:bg-green-200/80 hover:border-green-500"
              )
            : "border-green-400 bg-green-100/50 animate-pulse pointer-events-none"
        )}
        style={{
          left: desktopLeft,
          top: top + 2,
          width: desktopDayWidth,
          height: height - 4,
        }}
      >
        {/* Nội dung hiển thị trong block */}
        {isClickMode && !block.hasConflict && (
          <div className="h-full flex flex-col">
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="bg-green-500 text-white text-[9px] font-bold py-0.5 px-1 flex items-center justify-between shrink-0">
                <span>{filteredSections.length} LỰA CHỌN</span>
                <Users className="h-2.5 w-2.5" />
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/50">
                {filteredSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectSection(section);
                    }}
                    className="w-full text-left px-1.5 py-1 border-b border-green-100 hover:bg-green-100 transition-colors flex flex-col group"
                  >
                    <span className="text-[10px] font-bold text-green-800 truncate leading-tight">
                      {section.lecturer}
                    </span>
                    <span className="text-[9px] text-green-600 truncate opacity-80">{section.classCode}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile block */}
      {mobileVisible && (
        <div
          onClick={handleClick}
          className={cn(
            "absolute border-2 rounded-md transition-all z-20 overflow-hidden md:hidden",
            block.hasConflict
              ? "border-red-400 bg-red-100/50 pointer-events-none"
              : isClickMode
              ? cn(
                  "cursor-pointer pointer-events-auto",
                  hasMultipleOptions
                    ? "border-green-400 bg-green-50/90 shadow-sm"
                    : "border-green-400 bg-green-100/70 hover:bg-green-200/80 hover:border-green-500"
                )
              : "border-green-400 bg-green-100/50 animate-pulse pointer-events-none"
          )}
          style={{
            left: mobileLeft,
            top: top + 2,
            width: mobileDayWidth,
            height: height - 4,
          }}
        >
          {/* Nội dung hiển thị trong block */}
          {isClickMode && !block.hasConflict && (
            <div className="h-full flex flex-col">
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="bg-green-500 text-white text-[9px] font-bold py-0.5 px-1 flex items-center justify-between shrink-0">
                  <span>{filteredSections.length}</span>
                  <Users className="h-2.5 w-2.5" />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/50">
                  {filteredSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectSection(section);
                      }}
                      className="w-full text-left px-1 py-0.5 border-b border-green-100 hover:bg-green-100 transition-colors flex flex-col group"
                    >
                      <span className="text-[9px] font-bold text-green-800 truncate leading-tight">
                        {section.lecturer}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
