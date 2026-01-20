"use client";

/**
 * CalendarGrid Component
 * ======================
 * Lịch biểu dạng tuần với các ô thời gian có thể nhận drop
 * Highlight các slot có thể thả khi đang kéo môn học
 * Hỗ trợ click-to-place khi đã chọn môn học từ sidebar
 */

import React, { useMemo, useCallback, useState, useRef } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { useScheduleStore, useSlotHighlight } from "@/store/schedule-store";
import type { ScheduledClass } from "@/types";
import { DAY_NAMES, PERIOD_TIMES } from "@/types";
import { cn } from "@/lib/utils";

// Import extracted components
import { HighlightedBlocksOverlay } from "./HighlightedBlocks";
import { ScheduledClassesOverlay } from "./ScheduledClassesOverlay";
import { FlexibleClassesList, FlexibleSectionSelector } from "./FlexibleClasses";
import { ClassDetailContent } from "./ScheduledClassCard";

// Constants
const DAYS = [2, 3, 4, 5, 6, 7]; // Thứ 2 - Thứ 7
const PERIODS = Array.from({ length: 15 }, (_, i) => i + 1); // Tiết 1-15
const CELL_HEIGHT = 48; // px
const MOBILE_DAYS_PER_PAGE = 3;
const MOBILE_SWIPE_THRESHOLD = 50;

interface CalendarGridProps {
  showFullWeek?: boolean;
}

export function CalendarGrid({ showFullWeek = false }: CalendarGridProps) {
  const {
    scheduledClasses,
    removeClassFromSchedule,
    highlightedSlots,
    clickSelectedCourse,
    pendingTheorySection,
    filterOptions,
  } = useScheduleStore();

  // Mobile day pagination
  const [mobileDayPage, setMobileDayPage] = useState(0);
  // Mobile detail dialog
  const [selectedClassForDetail, setSelectedClassForDetail] = useState<ScheduledClass | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const totalMobilePages = Math.ceil(DAYS.length / MOBILE_DAYS_PER_PAGE);

  const visibleDays = useMemo(() => {
    const startIdx = mobileDayPage * MOBILE_DAYS_PER_PAGE;
    return DAYS.slice(startIdx, startIdx + MOBILE_DAYS_PER_PAGE);
  }, [mobileDayPage]);

  const mobileDays = showFullWeek ? DAYS : visibleDays;
  const canSwipe = !showFullWeek;

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>): void {
    if (!canSwipe) return;
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>): void {
    if (!canSwipe) return;
    if (!touchStartRef.current) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      event.preventDefault();
    }
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>): void {
    if (!canSwipe) return;
    if (!touchStartRef.current) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) < MOBILE_SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    if (deltaX < 0) {
      setMobileDayPage((page) => Math.min(totalMobilePages - 1, page + 1));
    } else {
      setMobileDayPage((page) => Math.max(0, page - 1));
    }
  }

  const { regularClasses, flexibleClasses } = useMemo(() => {
    const regular: ScheduledClass[] = [];
    const flexible: ScheduledClass[] = [];

    scheduledClasses.forEach((sc) => {
      if (sc.classSection.isFlexibleDay || sc.classSection.isFlexiblePeriod || sc.classSection.dayOfWeek === null) {
        flexible.push(sc);
      } else {
        regular.push(sc);
      }
    });

    return { regularClasses: regular, flexibleClasses: flexible };
  }, [scheduledClasses]);

  // Lấy các lớp flexible từ course đang được chọn (với logic lọc giống như highlightedSlots)
  const flexibleSectionsFromSelected = useMemo(() => {
    if (!clickSelectedCourse) return [];

    // Lấy các section flexible
    let flexibleSections = clickSelectedCourse.sections.filter(
      (s) => s.isFlexibleDay || s.isFlexiblePeriod || s.dayOfWeek === null
    );

    if (flexibleSections.length === 0) return [];

    // Lấy các lớp đã đăng ký của môn này
    const registeredSections = scheduledClasses
      .filter((sc) => sc.classSection.courseCode === clickSelectedCourse.courseCode)
      .map((sc) => sc.classSection);

    const registeredTheory = registeredSections.find((s) => !s.isPractical);
    const registeredPractical = registeredSections.find((s) => s.isPractical);

    // Nếu đã đăng ký cả LT và TH thì không hiển thị gì
    if (registeredTheory && registeredPractical) {
      return [];
    }

    // Kiểm tra xem TOÀN BỘ course (cả regular và flexible) có lớp LT không
    const courseHasTheorySections = clickSelectedCourse.sections.some((s) => !s.isPractical);

    // Nếu đang chờ chọn lớp TH (sau khi đã chọn LT), chỉ hiện TH khớp mã
    if (pendingTheorySection && pendingTheorySection.courseCode === clickSelectedCourse.courseCode) {
      flexibleSections = flexibleSections.filter(
        (s) => s.isPractical && s.classCode.startsWith(pendingTheorySection.classCode + ".")
      );
    }
    // Nếu đã có LT (ở lịch thường hoặc linh hoạt), chỉ hiện TH khớp mã
    else if (registeredTheory) {
      flexibleSections = flexibleSections.filter(
        (s) => s.isPractical && s.classCode.startsWith(registeredTheory.classCode + ".")
      );
    }
    // Nếu đã có TH, chỉ hiện LT khớp mã
    else if (registeredPractical) {
      flexibleSections = flexibleSections.filter(
        (s) => !s.isPractical && registeredPractical.classCode.startsWith(s.classCode + ".")
      );
    }
    // Nếu chưa đăng ký gì và course có lớp LT, chỉ hiện LT flexible (nếu có)
    else if (courseHasTheorySections) {
      flexibleSections = flexibleSections.filter((s) => !s.isPractical);
    }

    // Lọc bỏ các lớp đã bị đăng ký cùng loại
    flexibleSections = flexibleSections.filter((section) => {
      const sameTypeClass = registeredSections.find((s) => s.isPractical === section.isPractical);
      return !sameTypeClass;
    });

    return flexibleSections;
  }, [clickSelectedCourse, scheduledClasses, pendingTheorySection]);

  // Tính toán xem có cần hiển thị tiết 11+ không
  const maxPeriodUsed = useMemo(() => {
    let max = 10; // Mặc định hiển thị tới tiết 10

    // Kiểm tra trong các lớp đã đăng ký (chỉ regular classes)
    regularClasses.forEach((sc) => {
      const endPeriod = sc.classSection.startPeriod + sc.classSection.periodCount - 1;
      if (endPeriod > max) max = endPeriod;
    });

    // Kiểm tra trong các slot được highlight
    highlightedSlots.forEach((slot) => {
      if (slot.slot.period > max) max = slot.slot.period;
    });

    return max;
  }, [regularClasses, highlightedSlots]);

  const visiblePeriods = useMemo(() => {
    return PERIODS.filter((p) => p <= maxPeriodUsed);
  }, [maxPeriodUsed]);

  const mobileHeaderClass = showFullWeek ? "hidden" : "flex flex-1 md:hidden bg-white";
  const desktopHeaderClass = showFullWeek ? "flex flex-1 bg-white" : "hidden md:flex flex-1 bg-white";
  const mobileSlotClass = showFullWeek ? "hidden" : "flex flex-1 md:hidden";
  const desktopSlotClass = showFullWeek ? "flex flex-1" : "hidden md:flex flex-1";

  return (
    <div className="flex-1 overflow-auto bg-white">
      {/* Mobile day navigation */}
      <div
        className={cn(
          "flex items-center justify-between px-2 py-1 bg-gray-50 border-b md:hidden",
          showFullWeek && "hidden"
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileDayPage((p) => Math.max(0, p - 1))}
          disabled={mobileDayPage === 0}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-medium text-gray-600">
          {DAY_NAMES[mobileDays[0]]} - {DAY_NAMES[mobileDays[mobileDays.length - 1]]}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileDayPage((p) => Math.min(totalMobilePages - 1, p + 1))}
          disabled={mobileDayPage >= totalMobilePages - 1}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div
        id="schedule-calendar"
        className="bg-white p-2 sm:p-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header row - Days */}
        <div className="flex border-b sticky top-0 bg-white z-20 shadow-sm">
          <div className="w-14 sm:w-20 shrink-0 border-r bg-gray-50 p-1 sm:p-2 z-20">
            <span className="text-[10px] sm:text-xs font-medium text-gray-500">Tiết / Thứ</span>
          </div>
          {/* Mobile: show only visible days */}
          <div className={mobileHeaderClass}>
            {mobileDays.map((day) => (
              <div key={day} className="flex-1 border-r last:border-r-0 bg-gray-50 p-1 text-center z-20">
                <span className="font-semibold text-gray-700 text-xs">{DAY_NAMES[day]}</span>
              </div>
            ))}
          </div>
          {/* Desktop: show all days */}
          <div className={desktopHeaderClass}>
            {DAYS.map((day) => (
              <div key={day} className="flex-1 border-r last:border-r-0 bg-gray-50 p-3 text-center z-20">
                <span className="font-semibold text-gray-700 text-base">{DAY_NAMES[day]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Time slots grid */}
        <div className="relative">
          {visiblePeriods.map((period) => (
            <div key={period} className="flex border-b" style={{ height: CELL_HEIGHT }}>
              {/* Period label */}
              <div className="w-14 sm:w-20 shrink-0 border-r bg-gray-50 p-1 flex flex-col justify-center items-center">
                <span className="text-xs sm:text-sm font-medium text-gray-700">Tiết {period}</span>
                <span className="text-[9px] sm:text-xs text-gray-400">{PERIOD_TIMES[period]?.start}</span>
              </div>

              {/* Mobile: show currently paged days */}
              <div className={mobileSlotClass}>
                {mobileDays.map((day) => (
                  <TimeSlotCell key={`${day}-${period}`} dayOfWeek={day} period={period} />
                ))}
              </div>
              {/* Desktop: show all days */}
              <div className={desktopSlotClass}>
                {DAYS.map((day) => (
                  <TimeSlotCell key={`${day}-${period}`} dayOfWeek={day} period={period} />
                ))}
              </div>
            </div>
          ))}

          {/* Highlighted blocks overlay */}
          <HighlightedBlocksOverlay
            highlightedSlots={highlightedSlots}
            maxPeriod={maxPeriodUsed}
            visibleDays={mobileDays}
          />

          {/* Scheduled classes overlay */}
          <ScheduledClassesOverlay
            scheduledClasses={regularClasses}
            onRemove={removeClassFromSchedule}
            visibleDays={mobileDays}
          />
        </div>

        {/* Flexible schedule section */}
        {(flexibleClasses.length > 0 || flexibleSectionsFromSelected.length > 0) && (
          <div className="mt-6">
            <div className="mb-2 px-2">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Lịch Linh Hoạt
              </h3>
            </div>
            <div className="border rounded-lg overflow-hidden">
              {/* Hiện phần lựa chọn TRƯỚC phần đã xếp */}
              {flexibleSectionsFromSelected.length > 0 && (
                <FlexibleSectionSelector sections={flexibleSectionsFromSelected} />
              )}
              {flexibleClasses.length > 0 && (
                <FlexibleClassesList
                  classes={flexibleClasses}
                  onRemove={removeClassFromSchedule}
                  onClassClick={(cls) => {
                    setSelectedClassForDetail(cls);
                    setIsDetailOpen(true);
                  }}
                />
              )}
            </div>
          </div>
        )}
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
                  removeClassFromSchedule(selectedClassForDetail.id);
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
    </div>
  );
}

// ============ Time Slot Cell (Droppable) ============

interface TimeSlotCellProps {
  dayOfWeek: number;
  period: number;
}

function TimeSlotCell({ dayOfWeek, period }: TimeSlotCellProps) {
  const slotHighlight = useSlotHighlight(dayOfWeek, period);
  const { clickSelectedCourse, clickSelectedLecturer, addClassToSchedule, openClassSelectionModal } =
    useScheduleStore();

  // Determine cell state
  const isHighlighted = slotHighlight && slotHighlight.availableSections.length > 0;
  const hasConflict = slotHighlight?.hasConflict;
  const hasClickSelection = clickSelectedCourse !== null;

  // Handle click to place
  const handleClick = useCallback(() => {
    if (!hasClickSelection || !isHighlighted || hasConflict) return;

    // Get available sections for this slot
    const availableSections = slotHighlight?.availableSections || [];

    // Filter by lecturer if selected
    const filteredSections = clickSelectedLecturer
      ? availableSections.filter((s) => s.lecturer === clickSelectedLecturer)
      : availableSections;

    if (filteredSections.length === 0) return;

    if (filteredSections.length === 1) {
      // Only one option, add directly
      const result = addClassToSchedule(filteredSections[0]);
      if (!result.success) {
        if (result.error) {
          toast.error(result.error);
        } else if (result.conflicts.length > 0) {
          toast.error(`Trùng lịch với: ${result.conflicts[0].conflictingClasses.map((c) => c.courseName).join(", ")}`);
        }
      } else {
        toast.success(`Đã thêm ${filteredSections[0].courseName} vào lịch`);
      }
    } else {
      // Multiple options, show selection modal
      openClassSelectionModal(filteredSections, { dayOfWeek, period });
    }
  }, [
    hasClickSelection,
    isHighlighted,
    hasConflict,
    slotHighlight,
    clickSelectedLecturer,
    addClassToSchedule,
    openClassSelectionModal,
    dayOfWeek,
    period,
  ]);

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex-1 border-r last:border-r-0 relative transition-colors",
        // Base state
        !hasClickSelection && "bg-white hover:bg-gray-50",
        // Click selection mode - clickable highlighted slots
        hasClickSelection && isHighlighted && !hasConflict && "cursor-pointer",
        // Conflict state
        hasClickSelection && hasConflict && "bg-red-100",
        // When not a valid slot
        hasClickSelection && !isHighlighted && !hasConflict && "bg-gray-50/50"
      )}
    />
  );
}

export default CalendarGrid;
