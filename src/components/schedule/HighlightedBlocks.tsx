"use client";

/**
 * Component hiển thị các khối highlight trên lịch biểu khi chọn môn học từ Sidebar.
 * Tự động chia cột ngang khi nhiều lớp trùng tiết cùng ngày (tương tự Google Calendar) để người dùng dễ chọn hoặc thay thế 1-chạm.
 */

import React from "react";
import { Users, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useScheduleStore } from "@/store/schedule-store";
import type { ClassSection, HighlightedSlot } from "@/types";
import { cn } from "@/lib/utils";
import { ProfessorRatingBadge } from "./ProfessorReviewModal";

const DAYS = [2, 3, 4, 5, 6, 7];
const CELL_HEIGHT = 48;

interface BlockData {
  key: string;
  dayOfWeek: number;
  startPeriod: number;
  periodCount: number;
  hasConflict: boolean;
  sections: ClassSection[];
}

interface BlockLayout {
  column: number;
  totalColumns: number;
}

/**
 * Tính toán bố cục chia cột cho các khối highlight trùng giờ trong cùng một ngày.
 * Áp dụng thuật toán Greedy Interval Coloring kết hợp Union-Find.
 */
function computeBlockOverlapLayout(blocks: BlockData[]): Map<string, BlockLayout> {
  const result = new Map<string, BlockLayout>();
  if (blocks.length === 0) return result;

  // Group by dayOfWeek
  const byDay = new Map<number, BlockData[]>();
  for (const b of blocks) {
    if (!byDay.has(b.dayOfWeek)) byDay.set(b.dayOfWeek, []);
    byDay.get(b.dayOfWeek)!.push(b);
  }

  for (const [, dayBlocks] of byDay) {
    if (dayBlocks.length === 1) {
      result.set(dayBlocks[0].key, { column: 0, totalColumns: 1 });
      continue;
    }

    // Sort: earlier start first, then longer duration first
    const sorted = [...dayBlocks].sort((a, b) => {
      const diff = a.startPeriod - b.startPeriod;
      if (diff !== 0) return diff;
      return b.periodCount - a.periodCount;
    });

    // Greedy column assignment
    const columnEnds: number[] = [];
    const assignments: { block: BlockData; col: number }[] = [];

    for (const b of sorted) {
      const start = b.startPeriod;
      const end = start + b.periodCount;

      let assignedCol = -1;
      for (let c = 0; c < columnEnds.length; c++) {
        if (columnEnds[c] <= start) {
          assignedCol = c;
          break;
        }
      }

      if (assignedCol === -1) {
        assignedCol = columnEnds.length;
        columnEnds.push(end);
      } else {
        columnEnds[assignedCol] = end;
      }

      assignments.push({ block: b, col: assignedCol });
    }

    // Union-Find to group overlapping blocks
    const parent = new Map<string, string>();
    function find(id: string): string {
      if (!parent.has(id)) parent.set(id, id);
      if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
      return parent.get(id)!;
    }
    function union(a: string, b: string) {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    }

    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        const ai = assignments[i].block;
        const aj = assignments[j].block;
        const endI = ai.startPeriod + ai.periodCount;
        const endJ = aj.startPeriod + aj.periodCount;
        if (ai.startPeriod < endJ && aj.startPeriod < endI) {
          union(ai.key, aj.key);
        }
      }
    }

    const groupMaxCol = new Map<string, number>();
    for (const a of assignments) {
      const root = find(a.block.key);
      groupMaxCol.set(root, Math.max(groupMaxCol.get(root) || 0, a.col + 1));
    }

    for (const a of assignments) {
      const root = find(a.block.key);
      result.set(a.block.key, {
        column: a.col,
        totalColumns: groupMaxCol.get(root)!,
      });
    }
  }

  return result;
}

// ============ Highlighted Blocks Overlay ============

interface HighlightedBlocksOverlayProps {
  highlightedSlots: HighlightedSlot[];
  maxPeriod: number;
  visibleDays: number[];
}

export function HighlightedBlocksOverlay({ highlightedSlots, maxPeriod, visibleDays }: HighlightedBlocksOverlayProps) {
  const { clickSelectedCourse } = useScheduleStore();

  if (highlightedSlots.length === 0) return null;

  // Group sections by their exact slot range (day, start, count, hasConflict)
  // This avoids overlapping blocks and cleanly separates available vs conflicting blocks
  const blocksByRange = new Map<string, BlockData>();

  highlightedSlots.forEach((slot) => {
    const { dayOfWeek, period } = slot.slot;

    if (period > maxPeriod) return;

    // Available sections (Green blocks)
    slot.availableSections.forEach((section: ClassSection) => {
      const key = `${dayOfWeek}-${section.startPeriod}-${section.periodCount}-available`;

      if (!blocksByRange.has(key)) {
        blocksByRange.set(key, {
          key,
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
    });

    // Conflicting sections (Red blocks for replacement)
    (slot.conflictingSections || []).forEach((section: ClassSection) => {
      const key = `${dayOfWeek}-${section.startPeriod}-${section.periodCount}-conflict`;

      if (!blocksByRange.has(key)) {
        blocksByRange.set(key, {
          key,
          dayOfWeek,
          startPeriod: section.startPeriod,
          periodCount: section.periodCount,
          hasConflict: true,
          sections: [],
        });
      }

      const block = blocksByRange.get(key)!;
      if (!block.sections.find((s) => s.id === section.id)) {
        block.sections.push(section);
      }
    });
  });

  // Compute overlap layout for all blocks
  const allBlocks = Array.from(blocksByRange.values());
  const layoutMap = computeBlockOverlapLayout(allBlocks);

  // Render blocks
  const blockElements: JSX.Element[] = [];
  const isClickMode = clickSelectedCourse !== null;

  blocksByRange.forEach((block) => {
    const desktopDayIndex = DAYS.indexOf(block.dayOfWeek);
    const mobileDayIndex = visibleDays.indexOf(block.dayOfWeek);

    if (desktopDayIndex === -1) return;

    const layout = layoutMap.get(block.key) || { column: 0, totalColumns: 1 };

    blockElements.push(
      <ClickableHighlightBlock
        key={block.key}
        block={block}
        dayIndex={desktopDayIndex}
        mobileDayIndex={mobileDayIndex}
        mobileVisible={mobileDayIndex !== -1}
        mobileDaysCount={visibleDays.length}
        isClickMode={isClickMode}
        layoutColumn={layout.column}
        layoutTotalColumns={layout.totalColumns}
      />
    );
  });

  return <div className="absolute inset-0 z-30 left-12 sm:left-16 md:left-20 pointer-events-none">{blockElements}</div>;
}

// ============ Clickable Highlight Block ============

interface ClickableHighlightBlockProps {
  block: BlockData;
  dayIndex: number;
  mobileDayIndex: number;
  mobileVisible: boolean;
  mobileDaysCount: number;
  isClickMode: boolean;
  layoutColumn: number;
  layoutTotalColumns: number;
}

function ClickableHighlightBlock({
  block,
  dayIndex,
  mobileDayIndex,
  mobileVisible,
  mobileDaysCount,
  isClickMode,
  layoutColumn,
  layoutTotalColumns,
}: ClickableHighlightBlockProps) {
  const { addClassToSchedule, clickSelectedLecturer, replaceClassWithSection } = useScheduleStore();

  // Desktop positioning — divide day column into sub-columns for overlapping blocks
  const desktopDayWidth = 100 / DAYS.length; // percent
  const desktopSubWidth = desktopDayWidth / layoutTotalColumns;
  const desktopLeft = dayIndex * desktopDayWidth + layoutColumn * desktopSubWidth;

  // Mobile positioning — same approach
  const mobileDayWidth = 100 / mobileDaysCount;
  const mobileSubWidth = mobileDayWidth / layoutTotalColumns;
  const mobileLeft = mobileDayIndex * mobileDayWidth + layoutColumn * mobileSubWidth;

  const top = (block.startPeriod - 1) * CELL_HEIGHT;
  const height = block.periodCount * CELL_HEIGHT;

  // Lọc theo giảng viên nếu có chọn ở sidebar
  const filteredSections = clickSelectedLecturer
    ? block.sections.filter((s) => s.lecturer === clickSelectedLecturer)
    : block.sections;

  function handleSelectSection(section: ClassSection): void {
    if (block.hasConflict) {
      // 1-chạm thay thế ngay lập tức
      const result = replaceClassWithSection(section);
      if (result.success) {
        const removedNames = result.removedClasses?.map((c) => c.courseName).join(", ");
        toast.success(
          removedNames
            ? `Đã thay thế "${removedNames}" bằng "${section.courseName}"`
            : `Đã thay thế bằng "${section.courseName}"`
        );
      }
      return;
    }

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
    if (!isClickMode || filteredSections.length === 0) return;
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
          "absolute border-2 rounded-md transition-all overflow-hidden hidden md:block",
          block.hasConflict
            ? cn(
              "z-30 border-red-500 bg-red-50/95 shadow-md",
              isClickMode
                ? "cursor-pointer pointer-events-auto hover:bg-red-100 hover:border-red-600 hover:shadow-lg"
                : "pointer-events-none opacity-80"
            )
            : isClickMode
              ? cn(
                "z-20 cursor-pointer pointer-events-auto",
                hasMultipleOptions
                  ? "border-green-400 bg-green-50/90 shadow-sm"
                  : "border-green-400 bg-green-100/70 hover:bg-green-200/80 hover:border-green-500"
              )
              : "z-20 border-green-400 bg-green-100/50 animate-pulse pointer-events-none"
        )}
        style={{
          left: `${desktopLeft}%`,
          top: top + 2,
          width: `${desktopSubWidth}%`,
          height: height - 4,
        }}
      >
        {/* Nội dung hiển thị trong block */}
        {isClickMode && (
          <div className="h-full flex flex-col">
            <div className="flex-1 flex flex-col overflow-hidden">
              {block.hasConflict ? (
                <div className="bg-red-600 text-white text-[9px] font-bold py-0.5 px-1.5 flex items-center justify-between shrink-0 shadow-sm">
                  <span className="truncate">
                    {hasMultipleOptions ? `${filteredSections.length} LỚP TRÙNG` : "TRÙNG LỊCH"}
                  </span>
                  <RefreshCw className="h-2.5 w-2.5 shrink-0" />
                </div>
              ) : (
                <div className="bg-green-500 text-white text-[9px] font-bold py-0.5 px-1 flex items-center justify-between shrink-0">
                  <span>{filteredSections.length} LỰA CHỌN</span>
                  <Users className="h-2.5 w-2.5" />
                </div>
              )}
              <div
                className={cn(
                  "flex-1 overflow-y-auto custom-scrollbar",
                  block.hasConflict ? "bg-red-50/70" : "bg-white/50"
                )}
              >
                {filteredSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectSection(section);
                    }}
                    className={cn(
                      "w-full text-left px-1.5 py-1 border-b transition-colors flex flex-col group",
                      block.hasConflict
                        ? "border-red-200 hover:bg-red-200/90"
                        : "border-green-100 hover:bg-green-100"
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center flex-wrap gap-1 min-w-0">
                        <span
                          className={cn(
                            "text-[10px] font-bold break-words leading-tight",
                            block.hasConflict ? "text-red-950" : "text-green-800"
                          )}
                        >
                          {section.lecturer}
                        </span>
                        {section.lecturer && (
                          <ProfessorRatingBadge lecturerName={section.lecturer} size="sm" showText={false} />
                        )}
                      </div>
                      {block.hasConflict && (
                        <span className="text-[8px] font-bold text-white bg-red-600 px-1 py-0.2 rounded shrink-0 shadow-xs mt-0.5">
                          Thay thế
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-[9px] truncate",
                        block.hasConflict ? "text-red-800 font-medium" : "text-green-600 opacity-80"
                      )}
                    >
                      {section.classCode}
                    </span>
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
            "absolute border-2 rounded-md transition-all overflow-hidden md:hidden",
            block.hasConflict
              ? cn(
                "z-30 border-red-500 bg-red-50/95 shadow-md",
                isClickMode
                  ? "cursor-pointer pointer-events-auto hover:bg-red-100 hover:border-red-600"
                  : "pointer-events-none opacity-80"
              )
              : isClickMode
                ? cn(
                  "z-20 cursor-pointer pointer-events-auto",
                  hasMultipleOptions
                    ? "border-green-400 bg-green-50/90 shadow-sm"
                    : "border-green-400 bg-green-100/70 hover:bg-green-200/80 hover:border-green-500"
                )
                : "z-20 border-green-400 bg-green-100/50 animate-pulse pointer-events-none"
          )}
          style={{
            left: `${mobileLeft}%`,
            top: top + 2,
            width: `${mobileSubWidth}%`,
            height: height - 4,
          }}
        >
          {/* Nội dung hiển thị trong block */}
          {isClickMode && (
            <div className="h-full flex flex-col">
              <div className="flex-1 flex flex-col overflow-hidden">
                {block.hasConflict ? (
                  <div className="bg-red-600 text-white text-[9px] font-bold py-0.5 px-1 flex items-center justify-between shrink-0 shadow-sm">
                    <span className="truncate">Thay thế</span>
                    <RefreshCw className="h-2.5 w-2.5 shrink-0" />
                  </div>
                ) : (
                  <div className="bg-green-500 text-white text-[9px] font-bold py-0.5 px-1 flex items-center justify-between shrink-0">
                    <span>{filteredSections.length}</span>
                    <Users className="h-2.5 w-2.5" />
                  </div>
                )}
                <div
                  className={cn(
                    "flex-1 overflow-y-auto custom-scrollbar",
                    block.hasConflict ? "bg-red-50/70" : "bg-white/50"
                  )}
                >
                  {filteredSections.map((section) => (
                    <button
                      key={section.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectSection(section);
                      }}
                      className={cn(
                        "w-full text-left px-1 py-0.5 border-b transition-colors flex flex-col group",
                        block.hasConflict
                          ? "border-red-200 hover:bg-red-200/90"
                          : "border-green-100 hover:bg-green-100"
                      )}
                    >
                      <div className="flex items-center flex-wrap gap-1 min-w-0">
                        <span
                          className={cn(
                            "text-[9px] font-bold break-words leading-tight",
                            block.hasConflict ? "text-red-950" : "text-green-800"
                          )}
                        >
                          {section.lecturer}
                        </span>
                        {section.lecturer && (
                          <ProfessorRatingBadge lecturerName={section.lecturer} size="sm" showText={false} />
                        )}
                      </div>
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

export default HighlightedBlocksOverlay;

