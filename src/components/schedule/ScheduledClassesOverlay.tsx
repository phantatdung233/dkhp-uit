"use client";

/**
 * ScheduledClassesOverlay Component
 * ==================================
 * Overlay hiển thị các lớp học đã được xếp vào lịch trên CalendarGrid
 */

import React, { useState } from "react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { ScheduledClassCard, ClassDetailContent } from "./ScheduledClassCard";
import type { ScheduledClass } from "@/types";
import { COURSE_COLORS } from "@/types";

// Constants
const DAYS = [2, 3, 4, 5, 6, 7]; // Thứ 2 - Thứ 7
const CELL_HEIGHT = 48; // px

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

          const desktopDayWidth = `calc((100%) / ${DAYS.length})`;
          const desktopLeft = `calc(${desktopDayIndex} * ${desktopDayWidth})`;

          const mobileDayWidth = `calc((100%) / ${visibleDays.length})`;
          const mobileLeft = `calc(${mobileDayIndex} * ${mobileDayWidth})`;

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
                  left: desktopLeft,
                  top: top + 2,
                  width: desktopDayWidth,
                  height,
                  padding: "0 4px",
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
                    left: mobileLeft,
                    top: top + 2,
                    width: mobileDayWidth,
                    height,
                    padding: "0 2px",
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
