"use client";

/**
 * ScheduledClassesOverlay Component
 * ==================================
 * Overlay hiển thị các lớp học đã được xếp vào lịch trên CalendarGrid.
 *
 * Xử lý overlap: Khi nhiều lớp trùng tiết cùng ngày, chúng được chia cột
 * ngang (giống Google Calendar) để tất cả đều hiển thị và tương tác được.
 */

import React, { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { ScheduledClassCard, ClassDetailContent } from "./ScheduledClassCard";
import type { ScheduledClass } from "@/types";
import { COURSE_COLORS } from "@/types";

// Constants
const DAYS = [2, 3, 4, 5, 6, 7]; // Thứ 2 - Thứ 7
const CELL_HEIGHT = 48; // px

// ============ Overlap Layout Algorithm ============

interface LayoutInfo {
  /** Which column this card occupies (0-based) within its overlap group */
  column: number;
  /** Total number of columns in this card's overlap group */
  totalColumns: number;
}

/**
 * Compute column layout for overlapping scheduled classes on a given day.
 *
 * Algorithm (greedy interval graph colouring):
 *  1. Sort classes by startPeriod then by periodCount (longer first).
 *  2. Maintain a list of "column end times". For each class, find the first
 *     column whose end time ≤ class.startPeriod. If none, open a new column.
 *  3. After assignment, propagate the maximum column count to every class
 *     that overlaps with any other class in the same connected group so they
 *     all share the same width.
 *
 * Returns a Map from scheduledClass.id → LayoutInfo.
 */
function computeOverlapLayout(classes: ScheduledClass[]): Map<string, LayoutInfo> {
  const result = new Map<string, LayoutInfo>();
  if (classes.length === 0) return result;

  // Group by dayOfWeek
  const byDay = new Map<number, ScheduledClass[]>();
  for (const sc of classes) {
    const day = sc.classSection.dayOfWeek;
    if (day === null) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(sc);
  }

  for (const [, dayClasses] of byDay) {
    if (dayClasses.length === 1) {
      result.set(dayClasses[0].id, { column: 0, totalColumns: 1 });
      continue;
    }

    // Sort: earlier start first, then longer duration first (so wider blocks come first)
    const sorted = [...dayClasses].sort((a, b) => {
      const diff = a.classSection.startPeriod - b.classSection.startPeriod;
      if (diff !== 0) return diff;
      return b.classSection.periodCount - a.classSection.periodCount;
    });

    // Greedy column assignment
    // columnEnds[i] = the period at which column i becomes free
    const columnEnds: number[] = [];
    const assignments: { sc: ScheduledClass; col: number }[] = [];

    for (const sc of sorted) {
      const start = sc.classSection.startPeriod;
      const end = start + sc.classSection.periodCount; // exclusive end

      // Find first column where end ≤ start (i.e. column is free)
      let assignedCol = -1;
      for (let c = 0; c < columnEnds.length; c++) {
        if (columnEnds[c] <= start) {
          assignedCol = c;
          break;
        }
      }

      if (assignedCol === -1) {
        // Need a new column
        assignedCol = columnEnds.length;
        columnEnds.push(end);
      } else {
        columnEnds[assignedCol] = end;
      }

      assignments.push({ sc, col: assignedCol });
    }

    // Now find connected overlap groups and propagate totalColumns.
    // Two classes overlap if their period ranges intersect.
    // We use union-find to group them.
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

    // Check pairwise overlaps
    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        const ai = assignments[i].sc.classSection;
        const aj = assignments[j].sc.classSection;
        const startI = ai.startPeriod, endI = startI + ai.periodCount;
        const startJ = aj.startPeriod, endJ = startJ + aj.periodCount;
        if (startI < endJ && startJ < endI) {
          // Overlapping
          union(assignments[i].sc.id, assignments[j].sc.id);
        }
      }
    }

    // For each group, find max column used + 1
    const groupMaxCol = new Map<string, number>();
    for (const a of assignments) {
      const root = find(a.sc.id);
      groupMaxCol.set(root, Math.max(groupMaxCol.get(root) || 0, a.col + 1));
    }

    for (const a of assignments) {
      const root = find(a.sc.id);
      result.set(a.sc.id, {
        column: a.col,
        totalColumns: groupMaxCol.get(root)!,
      });
    }
  }

  return result;
}

// ============ Scheduled Classes Overlay ============

interface ScheduledClassesOverlayProps {
  scheduledClasses: ScheduledClass[];
  onRemove: (id: string) => void;
  visibleDays: number[];
}

export function ScheduledClassesOverlay({ scheduledClasses, onRemove, visibleDays }: ScheduledClassesOverlayProps) {
  const [selectedClassForDetail, setSelectedClassForDetail] = useState<ScheduledClass | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Group by courseCode for consistent colors
  const courseColorMap = new Map<string, number>();
  let colorIndex = 0;

  scheduledClasses.forEach((sc) => {
    if (!courseColorMap.has(sc.classSection.courseCode)) {
      courseColorMap.set(sc.classSection.courseCode, colorIndex++);
    }
  });

  // Compute overlap layout
  const layoutMap = useMemo(() => computeOverlapLayout(scheduledClasses), [scheduledClasses]);

  return (
    <>
      <div className="absolute inset-0 pointer-events-none z-10 left-14 sm:left-20">
        {scheduledClasses.map((scheduledClass) => {
          const section = scheduledClass.classSection;

          // Skip if flexible day or no day
          if (section.dayOfWeek === null) return null;

          const desktopDayIndex = DAYS.indexOf(section.dayOfWeek);
          const mobileDayIndex = visibleDays.indexOf(section.dayOfWeek);

          if (desktopDayIndex === -1) return null;

          const layout = layoutMap.get(scheduledClass.id) || { column: 0, totalColumns: 1 };

          // Desktop: divide the day column into sub-columns
          const desktopDayWidth = 100 / DAYS.length; // percent
          const desktopSubWidth = desktopDayWidth / layout.totalColumns;
          const desktopLeft = desktopDayIndex * desktopDayWidth + layout.column * desktopSubWidth;

          // Mobile: same approach
          const mobileDayWidth = 100 / visibleDays.length;
          const mobileSubWidth = mobileDayWidth / layout.totalColumns;
          const mobileLeft = mobileDayIndex * mobileDayWidth + layout.column * mobileSubWidth;

          const top = (section.startPeriod - 1) * CELL_HEIGHT;
          const height = section.periodCount * CELL_HEIGHT - 4; // -4 for gap

          const colorIdx = courseColorMap.get(section.courseCode) || 0;
          const colorClass = COURSE_COLORS[colorIdx % COURSE_COLORS.length];

          return (
            <React.Fragment key={scheduledClass.id}>
              {/* Desktop card */}
              <ScheduledClassCard
                scheduledClass={scheduledClass}
                className="hidden md:block"
                style={{
                  position: "absolute",
                  left: `${desktopLeft}%`,
                  top: top + 2,
                  width: `${desktopSubWidth}%`,
                  height,
                  padding: "0 2px",
                }}
                colorClass={colorClass}
                onRemove={() => onRemove(scheduledClass.id)}
              />
              {/* Mobile card */}
              {mobileDayIndex !== -1 && (
                <ScheduledClassCard
                  scheduledClass={scheduledClass}
                  className="md:hidden"
                  style={{
                    position: "absolute",
                    left: `${mobileLeft}%`,
                    top: top + 2,
                    width: `${mobileSubWidth}%`,
                    height,
                    padding: "0 1px",
                  }}
                  colorClass={colorClass}
                  onRemove={() => onRemove(scheduledClass.id)}
                  compact
                  isMobile
                  onClick={() => {
                    setSelectedClassForDetail(scheduledClass);
                    setIsDetailOpen(true);
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile detail dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thông tin môn học</DialogTitle>
          </DialogHeader>
          {selectedClassForDetail && <ClassDetailContent scheduledClass={selectedClassForDetail} />}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (selectedClassForDetail) {
                  onRemove(selectedClassForDetail.id);
                  setIsDetailOpen(false);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Xóa khỏi lịch
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsDetailOpen(false)}>
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

