"use client";

/**
 * Component hiển thị lưới thời khóa biểu tuần (Thứ 2 - Thứ 7, Tiết 1 - 15).
 * Hỗ trợ kéo thả, click-to-place khi chọn môn từ Sidebar, highlight các ô khả dụng và cử chỉ vuốt trên di động.
 */

import React, { useMemo, useCallback, useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useScheduleStore, useSlotHighlight } from "@/store/schedule-store";
import type { ScheduledClass } from "@/types";
import { DAY_NAMES, PERIOD_TIMES } from "@/types";
import { cn } from "@/lib/utils";

import { HighlightedBlocksOverlay } from "./HighlightedBlocks";
import { ScheduledClassesOverlay } from "./ScheduledClassesOverlay";
import { FlexibleClassesList, FlexibleSectionSelector } from "./FlexibleClasses";
import { ScheduledClassDetailModal } from "./ScheduledClassDetailModal";

const DAYS = [2, 3, 4, 5, 6, 7];
const PERIODS = Array.from({ length: 15 }, (_, i) => i + 1);
const CELL_HEIGHT = 48;
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
  } = useScheduleStore();

  const [mobileDayPage, setMobileDayPage] = useState(0);
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

  // Lọc các lớp thời gian linh hoạt từ môn đang được chọn
  const flexibleSectionsFromSelected = useMemo(() => {
    if (!clickSelectedCourse) return [];

    let flexibleSections = clickSelectedCourse.sections.filter(
      (s) => s.isFlexibleDay || s.isFlexiblePeriod || s.dayOfWeek === null
    );

    if (flexibleSections.length === 0) return [];

    const registeredSections = scheduledClasses
      .filter((sc) => sc.classSection.courseCode === clickSelectedCourse.courseCode)
      .map((sc) => sc.classSection);

    const registeredTheory = registeredSections.find((s) => !s.isPractical);
    const registeredPractical = registeredSections.find((s) => s.isPractical);

    if (registeredTheory && registeredPractical) {
      return [];
    }

    const courseHasTheorySections = clickSelectedCourse.sections.some((s) => !s.isPractical);

    if (pendingTheorySection && pendingTheorySection.courseCode === clickSelectedCourse.courseCode) {
      flexibleSections = flexibleSections.filter(
        (s) => s.isPractical && s.classCode.startsWith(pendingTheorySection.classCode + ".")
      );
    } else if (registeredTheory) {
      flexibleSections = flexibleSections.filter(
        (s) => s.isPractical && s.classCode.startsWith(registeredTheory.classCode + ".")
      );
    } else if (registeredPractical) {
      flexibleSections = flexibleSections.filter(
        (s) => !s.isPractical && registeredPractical.classCode.startsWith(s.classCode + ".")
      );
    } else if (courseHasTheorySections) {
      flexibleSections = flexibleSections.filter((s) => !s.isPractical);
    }

    flexibleSections = flexibleSections.filter((section) => {
      const sameTypeClass = registeredSections.find((s) => s.isPractical === section.isPractical);
      return !sameTypeClass;
    });

    return flexibleSections;
  }, [clickSelectedCourse, scheduledClasses, pendingTheorySection]);

  // Ẩn bớt các tiết tối 11-15 nếu lịch hiện tại không sử dụng đến
  const maxPeriodUsed = useMemo(() => {
    let max = 10;

    regularClasses.forEach((sc) => {
      const endPeriod = sc.classSection.startPeriod + sc.classSection.periodCount - 1;
      if (endPeriod > max) max = endPeriod;
    });

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
      {/* Thanh điều hướng trang ngày trên mobile */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-1.5 bg-gray-50/90 backdrop-blur-xs border-b sticky top-0 z-30 md:hidden",
          showFullWeek && "hidden"
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileDayPage((p) => Math.max(0, p - 1))}
          disabled={mobileDayPage === 0}
          className="h-7 w-7 p-0 rounded-full hover:bg-gray-200"
          aria-label="3 ngày trước"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-full border shadow-2xs">
            <span className="text-xs font-semibold text-gray-700">
              {DAY_NAMES[mobileDays[0]]} - {DAY_NAMES[mobileDays[mobileDays.length - 1]]}
            </span>
          </div>
          {/* Quick page dots */}
          <div className="flex items-center gap-1 ml-1">
            {Array.from({ length: totalMobilePages }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setMobileDayPage(idx)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  mobileDayPage === idx ? "w-4 bg-primary" : "w-1.5 bg-gray-300 hover:bg-gray-400"
                )}
                aria-label={`Trang ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileDayPage((p) => Math.min(totalMobilePages - 1, p + 1))}
          disabled={mobileDayPage >= totalMobilePages - 1}
          className="h-7 w-7 p-0 rounded-full hover:bg-gray-200"
          aria-label="3 ngày tiếp theo"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div
        id="schedule-calendar"
        className="bg-white p-1.5 sm:p-3 md:p-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Hàng tiêu đề các thứ trong tuần */}
        <div className="flex border-b sticky top-0 bg-white z-20 shadow-xs">
          <div className="w-12 sm:w-16 md:w-20 shrink-0 border-r bg-gray-50 p-1 sm:p-2 z-20 flex items-center justify-center text-center">
            <span className="text-[9.5px] sm:text-xs font-medium text-gray-500">Tiết / Thứ</span>
          </div>

          <div className={mobileHeaderClass}>
            {mobileDays.map((day) => (
              <div key={day} className="flex-1 border-r last:border-r-0 bg-gray-50 p-1 sm:p-1.5 text-center z-20">
                <span className="font-bold text-gray-700 text-xs sm:text-sm">{DAY_NAMES[day]}</span>
              </div>
            ))}
          </div>

          <div className={desktopHeaderClass}>
            {DAYS.map((day) => (
              <div key={day} className="flex-1 border-r last:border-r-0 bg-gray-50 p-2 sm:p-3 text-center z-20">
                <span className="font-bold text-gray-700 text-sm md:text-base">{DAY_NAMES[day]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Lưới các ô thời gian */}
        <div className="relative">
          {visiblePeriods.map((period) => (
            <div key={period} className="flex border-b" style={{ height: CELL_HEIGHT }}>
              <div className="w-12 sm:w-16 md:w-20 shrink-0 border-r bg-gray-50 p-0.5 sm:p-1 flex flex-col justify-center items-center text-center">
                <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-gray-700 leading-tight">Tiết {period}</span>
                <span className="text-[8.5px] sm:text-[10px] md:text-xs text-gray-400 leading-tight">{PERIOD_TIMES[period]?.start}</span>
              </div>

              <div className={mobileSlotClass}>
                {mobileDays.map((day) => (
                  <TimeSlotCell key={`${day}-${period}`} dayOfWeek={day} period={period} />
                ))}
              </div>

              <div className={desktopSlotClass}>
                {DAYS.map((day) => (
                  <TimeSlotCell key={`${day}-${period}`} dayOfWeek={day} period={period} />
                ))}
              </div>
            </div>
          ))}

          {/* Lớp hiển thị các thẻ môn học đã xếp */}
          <ScheduledClassesOverlay
            scheduledClasses={regularClasses}
            onRemove={removeClassFromSchedule}
            visibleDays={mobileDays}
          />

          {/* Lớp highlight các slot trống/trùng khi chọn môn */}
          <HighlightedBlocksOverlay
            highlightedSlots={highlightedSlots}
            maxPeriod={maxPeriodUsed}
            visibleDays={mobileDays}
          />
        </div>

        {/* Khu vực danh sách môn học có lịch linh hoạt (Đồ án, KLTN, Online) */}
        {(flexibleClasses.length > 0 || flexibleSectionsFromSelected.length > 0) && (
          <div className="mt-6">
            <div className="mb-2 px-2">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                Thời Gian Linh Hoạt
              </h3>
            </div>
            <div className="border rounded-lg overflow-hidden">
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

      {/* Modal chi tiết môn học & đánh giá giảng viên */}
      <ScheduledClassDetailModal
        scheduledClass={selectedClassForDetail}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onRemove={(id) => {
          removeClassFromSchedule(id);
          setIsDetailOpen(false);
        }}
      />
    </div>
  );
}

interface TimeSlotCellProps {
  dayOfWeek: number;
  period: number;
}

/**
 * Đại diện cho một ô thời gian đơn lẻ trên lưới TKB, hỗ trợ click để xếp hoặc thay thế lớp.
 */
function TimeSlotCell({ dayOfWeek, period }: TimeSlotCellProps) {
  const slotHighlight = useSlotHighlight(dayOfWeek, period);
  const {
    clickSelectedCourse,
    clickSelectedLecturer,
    scheduledClasses,
    addClassToSchedule,
    replaceClassWithSection,
    openClassSelectionModal,
  } = useScheduleStore();

  const isHighlighted = slotHighlight && slotHighlight.availableSections.length > 0;
  const hasConflict = slotHighlight?.hasConflict;
  const hasConflictingSections = (slotHighlight?.conflictingSections?.length || 0) > 0;
  const hasClickSelection = clickSelectedCourse !== null;

  const handleClick = useCallback(() => {
    if (!hasClickSelection) return;

    // Thay thế lớp khi click vào ô xung đột
    if (hasConflict || hasConflictingSections) {
      const conflictingSections = slotHighlight?.conflictingSections || [];
      const filteredConflicting = clickSelectedLecturer
        ? conflictingSections.filter((s) => s.lecturer === clickSelectedLecturer)
        : conflictingSections;

      if (filteredConflicting.length === 1) {
        const section = filteredConflicting[0];
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
      } else if (filteredConflicting.length > 1) {
        openClassSelectionModal(filteredConflicting, { dayOfWeek, period });
        return;
      }
    }

    if (!isHighlighted || hasConflict) return;

    const availableSections = slotHighlight?.availableSections || [];
    const filteredSections = clickSelectedLecturer
      ? availableSections.filter((s) => s.lecturer === clickSelectedLecturer)
      : availableSections;

    if (filteredSections.length === 0) return;

    if (filteredSections.length === 1) {
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
      openClassSelectionModal(filteredSections, { dayOfWeek, period });
    }
  }, [
    hasClickSelection,
    hasConflict,
    hasConflictingSections,
    isHighlighted,
    slotHighlight,
    clickSelectedLecturer,
    scheduledClasses,
    addClassToSchedule,
    replaceClassWithSection,
    openClassSelectionModal,
    dayOfWeek,
    period,
  ]);

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex-1 border-r last:border-r-0 relative transition-colors",
        !hasClickSelection && "bg-white hover:bg-gray-50",
        hasClickSelection && isHighlighted && !hasConflict && "cursor-pointer",
        hasClickSelection && hasConflict && "bg-red-100/60 cursor-pointer",
        hasClickSelection && !isHighlighted && !hasConflict && "bg-gray-50/50"
      )}
    />
  );
}

export default CalendarGrid;

