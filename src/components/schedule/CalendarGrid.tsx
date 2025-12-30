"use client";

/**
 * CalendarGrid Component
 * ======================
 * Lịch biểu dạng tuần với các ô thời gian có thể nhận drop
 * Highlight các slot có thể thả khi đang kéo môn học
 * Hỗ trợ click-to-place khi đã chọn môn học từ sidebar
 */

import React, { useMemo, useCallback, useState, useRef } from "react";
import {
  X,
  Clock,
  MapPin,
  User,
  AlertTriangle,
  Calendar,
  Users,
  Plus,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  GraduationCap,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { useScheduleStore, useSlotHighlight } from "@/store/schedule-store";
import type { ClassSection, ScheduledClass, HighlightedSlot } from "@/types";
import { DAY_NAMES, PERIOD_TIMES, COURSE_COLORS } from "@/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";

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
    clickSelectedType,
    pendingTheorySection,
    filterOptions,
  } = useScheduleStore();

  // Mobile day pagination
  const [mobileDayPage, setMobileDayPage] = useState(0);
  // Mobile detail dialog
  const [selectedClassForDetail, setSelectedClassForDetail] = useState<ScheduledClass | null>(null);
  const totalMobilePages = Math.ceil(DAYS.length / MOBILE_DAYS_PER_PAGE);

  const visibleDays = useMemo(() => {
    const startIdx = mobileDayPage * MOBILE_DAYS_PER_PAGE;
    return DAYS.slice(startIdx, startIdx + MOBILE_DAYS_PER_PAGE);
  }, [mobileDayPage]);

  const mobileDays = showFullWeek ? DAYS : visibleDays;
  const canSwipe = !showFullWeek;

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!canSwipe) return;
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!canSwipe) return;
    if (!touchStartRef.current) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      event.preventDefault();
    }
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
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
  };

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
    // Nếu có clickSelectedType cụ thể
    else if (clickSelectedType === "practical") {
      flexibleSections = flexibleSections.filter((s) => s.isPractical);
    } else if (clickSelectedType === "theory") {
      flexibleSections = flexibleSections.filter((s) => !s.isPractical);
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
    // Nếu LT chỉ ở lịch bình thường thì không hiện gì ở flexible (user phải chọn LT trước)
    else if (courseHasTheorySections) {
      flexibleSections = flexibleSections.filter((s) => !s.isPractical);
    }
    // Nếu course không có lớp LT nào (chỉ có TH), hiện tất cả TH flexible

    // Lọc theo nhóm đặc thù (ANTT/TTNT)
    const specialGroup = filterOptions.specialGroup;
    if (specialGroup === "none") {
      flexibleSections = flexibleSections.filter(
        (s) => !s.classCode.includes(".ANTT") && !s.classCode.includes(".TTNT")
      );
    } else {
      const groupTag = `.${specialGroup}`;
      const groupSections = flexibleSections.filter((s) => s.classCode.includes(groupTag));
      if (groupSections.length > 0) {
        flexibleSections = groupSections;
      } else {
        flexibleSections = flexibleSections.filter(
          (s) => !s.classCode.includes(".ANTT") && !s.classCode.includes(".TTNT")
        );
      }
    }

    // Lọc bỏ các lớp đã bị đăng ký cùng loại
    flexibleSections = flexibleSections.filter((section) => {
      const sameTypeClass = registeredSections.find((s) => s.isPractical === section.isPractical);
      return !sameTypeClass;
    });

    return flexibleSections;
  }, [clickSelectedCourse, scheduledClasses, pendingTheorySection, filterOptions.specialGroup]);

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
                  onClassClick={setSelectedClassForDetail}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile detail dialog */}
      <Dialog open={selectedClassForDetail !== null} onOpenChange={() => setSelectedClassForDetail(null)}>
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
                  setSelectedClassForDetail(null);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Xóa khỏi lịch
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedClassForDetail(null)}>
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
  const {
    clickSelectedCourse,
    clickSelectedLecturer,
    addClassToSchedule,
    openClassSelectionModal,
    clearClickSelection,
  } = useScheduleStore();

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

// ============ Highlighted Blocks Overlay ============

interface HighlightedBlocksOverlayProps {
  highlightedSlots: HighlightedSlot[];
  maxPeriod: number;
  visibleDays: number[];
}

function HighlightedBlocksOverlay({ highlightedSlots, maxPeriod, visibleDays }: HighlightedBlocksOverlayProps) {
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

  const handleSelectSection = (section: ClassSection) => {
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
  };

  const handleClick = () => {
    if (block.hasConflict || !isClickMode) return;
    if (filteredSections.length === 1) {
      handleSelectSection(filteredSections[0]);
    }
  };

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

// ============ Scheduled Classes Overlay ============

interface ScheduledClassesOverlayProps {
  scheduledClasses: ScheduledClass[];
  onRemove: (id: string) => void;
  visibleDays: number[];
}

function ScheduledClassesOverlay({ scheduledClasses, onRemove, visibleDays }: ScheduledClassesOverlayProps) {
  const [selectedClassForDetail, setSelectedClassForDetail] = useState<ScheduledClass | null>(null);

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
                  onClick={() => setSelectedClassForDetail(scheduledClass)}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile detail dialog */}
      <Dialog open={selectedClassForDetail !== null} onOpenChange={() => setSelectedClassForDetail(null)}>
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
                  setSelectedClassForDetail(null);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Xóa khỏi lịch
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedClassForDetail(null)}>
              Đóng
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============ Scheduled Class Card ============

interface ScheduledClassCardProps {
  scheduledClass: ScheduledClass;
  style: React.CSSProperties;
  colorClass: string;
  onRemove: () => void;
  className?: string;
  compact?: boolean;
  isMobile?: boolean;
  onClick?: () => void;
}

function ScheduledClassCard({
  scheduledClass,
  style,
  colorClass,
  onRemove,
  className,
  compact: mobileCompact,
  isMobile,
  onClick,
}: ScheduledClassCardProps) {
  const section = scheduledClass.classSection;
  const isCompact = section.periodCount <= 2 || mobileCompact;

  const handleCardClick = (e: React.MouseEvent) => {
    // Chỉ gọi onClick khi ở mobile và không phải click vào nút xóa
    if (isMobile && onClick && !(e.target as HTMLElement).closest("button")) {
      onClick();
    }
  };

  const cardContent = (
    <div style={style} className={cn("pointer-events-auto group", className)}>
      <div
        onClick={handleCardClick}
        className={cn(
          "h-full w-full rounded-md border-2 overflow-hidden relative",
          "shadow-sm hover:shadow-md transition-shadow",
          isMobile ? "cursor-pointer" : "cursor-default",
          mobileCompact ? "p-1" : "p-1.5",
          colorClass
        )}
      >
        {/* Remove button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1 right-1 p-0.5 rounded-full bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <X className="h-3 w-3 text-gray-600" />
        </button>

        {/* Content */}
        <div className="h-full flex flex-col">
          <p className={cn("font-medium mt-0.5", mobileCompact ? "text-[9px]" : "text-[11px]")}>{section.classCode}</p>
          <h4
            className={cn(
              "font-bold leading-tight",
              mobileCompact ? "text-[10px] truncate" : "text-[13px]",
              isCompact ? "truncate" : "break-words"
            )}
          >
            {section.courseName}
          </h4>

          {!isCompact ? (
            <div className="mt-1 space-y-0.5">
              <div className="flex items-center gap-1 text-[12px] opacity-70">
                <User className="h-3 w-3 shrink-0" />
                <span className="font-bold truncate">{section.lecturer}</span>
              </div>
              {section.room && (
                <div className="flex items-center gap-1 text-[12px] opacity-70">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="font-bold break-words">{section.room}</span>
                </div>
              )}
              {(section.startDate || section.endDate) && (
                <div className="flex items-center gap-1 text-[12px] opacity-70 border-t border-black/5 pt-0.5 mt-0.5">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span className="font-bold break-words">
                    {section.startDate ? format(section.startDate, "dd/MM") : "?"} -{" "}
                    {section.endDate ? format(section.endDate, "dd/MM") : "?"}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-auto space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] sm:text-[12px] opacity-70">
                <User className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                <span className="font-bold truncate">{section.lecturer}</span>
              </div>
              {section.room && (
                <div className="flex items-center gap-1 text-[10px] sm:text-[12px] opacity-70">
                  <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                  <span className="font-bold truncate">{section.room}</span>
                </div>
              )}
              {mobileCompact && section.periodCount >= 3 && (section.startDate || section.endDate) && (
                <div className="flex items-center gap-1 text-[9px] opacity-60 border-t border-black/5 pt-0.5 mt-0.5">
                  <Calendar className="h-2 w-2 shrink-0" />
                  <span className="truncate">
                    {section.startDate ? format(section.startDate, "dd/MM") : "?"}-
                    {section.endDate ? format(section.endDate, "dd/MM") : "?"}
                  </span>
                </div>
              )}
            </div>
          )}

          <Badge
            variant={section.isPractical ? "warning" : "info"}
            className="absolute bottom-1 right-1 text-[8px] px-1 h-3.5 leading-none"
          >
            {section.isPractical ? "TH" : "LT"}
          </Badge>
        </div>
      </div>
    </div>
  );

  // Trên mobile không hiển thị tooltip, chỉ có click
  if (isMobile) {
    return cardContent;
  }

  // Trên desktop hiển thị tooltip khi hover
  return (
    <Tooltip>
      <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <ClassSectionTooltip section={section} />
      </TooltipContent>
    </Tooltip>
  );
}

// ============ Flexible Classes List ============

interface FlexibleClassesListProps {
  classes: ScheduledClass[];
  onRemove: (id: string) => void;
  onClassClick?: (scheduledClass: ScheduledClass) => void;
}

function FlexibleClassesList({ classes, onRemove, onClassClick }: FlexibleClassesListProps) {
  const { scheduledClasses } = useScheduleStore();

  // Build color map from ALL scheduled classes (both regular and flexible) for consistent colors
  const courseColorMap = new Map<string, number>();
  let colorIndex = 0;

  scheduledClasses.forEach((sc) => {
    if (!courseColorMap.has(sc.classSection.courseCode)) {
      courseColorMap.set(sc.classSection.courseCode, colorIndex++);
    }
  });

  // Xác định loại flexible cho tooltip
  const getFlexibleType = (section: ClassSection) => {
    if (section.isFlexibleDay && section.isFlexiblePeriod) {
      return "Linh hoạt";
    } else if (section.isFlexibleDay) {
      return "Thứ linh hoạt";
    } else if (section.isFlexiblePeriod) {
      return `${DAY_NAMES[section.dayOfWeek!]} - Linh hoạt`;
    } else if (section.dayOfWeek === null) {
      return "Thời gian chưa xác định";
    }
    return "";
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-2 p-3">
      {classes.map((scheduledClass) => {
        const section = scheduledClass.classSection;
        const colorIdx = courseColorMap.get(section.courseCode) || 0;
        const colorClass = COURSE_COLORS[colorIdx % COURSE_COLORS.length];
        const flexibleType = getFlexibleType(section);

        const handleFlexibleCardClick = (e: React.MouseEvent) => {
          // Chỉ xử lý click trên mobile, bỏ qua nếu click vào nút xóa
          if (onClassClick && !(e.target as HTMLElement).closest('button')) {
            onClassClick(scheduledClass);
          }
        };

        // Nội dung card dùng chung
        const cardInnerContent = (
          <>
            {/* Remove button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(scheduledClass.id);
              }}
              className="absolute top-1 right-1 p-0.5 rounded-full bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <X className="h-3 w-3 text-gray-600" />
            </button>

            {/* Content */}
            <div className="h-full flex flex-col">
              <p className="font-medium text-[11px] mt-0.5">{section.classCode}</p>
              <h4 className="font-bold leading-tight text-[13px] line-clamp-1">{section.courseName}</h4>

              <div className="mt-1 space-y-0.5">
                <div className="flex items-center gap-1 text-[12px] opacity-70">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="font-bold truncate">{section.lecturer}</span>
                </div>
                {section.room && (
                  <div className="flex items-center gap-1 text-[12px] opacity-70">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="font-bold truncate">{section.room}</span>
                  </div>
                )}
                {(section.startDate || section.endDate) && (
                  <div className="flex items-center gap-1 text-[12px] opacity-70 border-t border-black/5 pt-0.5 mt-0.5">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span className="font-bold truncate">
                      {section.startDate ? format(section.startDate, "dd/MM") : "?"} -{" "}
                      {section.endDate ? format(section.endDate, "dd/MM") : "?"}
                    </span>
                  </div>
                )}
              </div>

              <Badge
                variant={section.isPractical ? "warning" : "info"}
                className="absolute bottom-1 right-1 text-[8px] px-1 h-3.5 leading-none"
              >
                {section.isPractical ? "TH" : "LT"}
              </Badge>
            </div>
          </>
        );

        return (
          <>
            {/* Desktop: với tooltip, KHÔNG có click */}
            <div key={`${scheduledClass.id}-desktop`} className="hidden md:block group relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "h-full min-h-[70px] rounded-md border-2 p-2 overflow-hidden relative",
                      "shadow-sm hover:shadow-md transition-shadow cursor-default",
                      colorClass
                    )}
                  >
                    {cardInnerContent}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <FlexibleClassTooltip section={section} flexibleType={flexibleType} />
                </TooltipContent>
              </Tooltip>
            </div>
            
            {/* Mobile: CÓ click để mở dialog */}
            <div key={`${scheduledClass.id}-mobile`} className="md:hidden group relative">
              <div
                onClick={handleFlexibleCardClick}
                className={cn(
                  "h-full min-h-[70px] rounded-md border-2 p-2 overflow-hidden relative cursor-pointer",
                  "shadow-sm hover:shadow-md transition-shadow",
                  colorClass
                )}
              >
                {cardInnerContent}
              </div>
            </div>
          </>
        );
      })}
    </div>
  );
}

// ============ Flexible Class Tooltip ============

function FlexibleClassTooltip({ section, flexibleType }: { section: ClassSection; flexibleType: string }) {
  return (
    <div className="space-y-2">
      <div>
        <h4 className="font-semibold">{section.courseName}</h4>
        <p className="text-sm text-gray-500">{section.classCode}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="flex items-center gap-1">
          <User className="h-4 w-4 text-gray-400" />
          <span>{section.lecturer}</span>
        </div>
        <div className="flex items-center gap-1 text-orange-600">
          <Clock className="h-4 w-4" />
          <span>{flexibleType}</span>
        </div>
        {section.room && (
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4 text-gray-400" />
            <span>{section.room}</span>
          </div>
        )}
        <div>
          <Badge variant={section.isPractical ? "warning" : "info"}>
            {section.isPractical ? "Thực hành" : "Lý thuyết"}
          </Badge>
        </div>
      </div>

      {(section.startDate || section.endDate) && (
        <div className="text-xs text-gray-500 border-t pt-2">
          {section.startDate && <span>Từ: {format(section.startDate, "dd/MM/yyyy", { locale: vi })}</span>}
          {section.startDate && section.endDate && " - "}
          {section.endDate && <span>Đến: {format(section.endDate, "dd/MM/yyyy", { locale: vi })}</span>}
        </div>
      )}

      <div className="flex gap-2">
        <Badge variant="secondary">{section.credits} tín chỉ</Badge>
        {section.maxStudents && <Badge variant="outline">Sĩ số: {section.maxStudents}</Badge>}
      </div>
    </div>
  );
}

// ============ Flexible Section Selector ============

interface FlexibleSectionSelectorProps {
  sections: ClassSection[];
}

function FlexibleSectionSelector({ sections }: FlexibleSectionSelectorProps) {
  const { addClassToSchedule, clickSelectedLecturer, scheduledClasses } = useScheduleStore();

  // Build color map from ALL scheduled classes for consistent colors
  const courseColorMap = new Map<string, number>();
  let colorIndex = 0;
  scheduledClasses.forEach((sc) => {
    if (!courseColorMap.has(sc.classSection.courseCode)) {
      courseColorMap.set(sc.classSection.courseCode, colorIndex++);
    }
  });

  // Lọc theo giảng viên nếu có
  const filteredSections = clickSelectedLecturer
    ? sections.filter((s) => s.lecturer === clickSelectedLecturer)
    : sections;

  const handleSelectSection = (section: ClassSection) => {
    const result = addClassToSchedule(section);
    if (!result.success) {
      if (result.error) {
        toast.error(result.error);
      } else if (result.conflicts.length > 0) {
        toast.error(`Trùng lịch với: ${result.conflicts[0].conflictingClasses.map((c) => c.courseName).join(", ")}`);
      }
    } else {
      toast.success(`Đã thêm ${section.courseName} vào lịch linh hoạt`);
    }
  };

  // Xác định loại flexible
  const getFlexibleType = (section: ClassSection) => {
    if (section.isFlexibleDay && section.isFlexiblePeriod) {
      return "Linh hoạt";
    } else if (section.isFlexibleDay) {
      return "Thứ linh hoạt";
    } else if (section.isFlexiblePeriod) {
      return `${DAY_NAMES[section.dayOfWeek!]} - Linh hoạt`;
    } else if (section.dayOfWeek === null) {
      return "Chưa xác định";
    }
    return "";
  };

  if (filteredSections.length === 0) return null;

  return (
    <div className="bg-green-50 border-t-2 border-green-200">
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-green-700">{filteredSections.length} Lựa Chọn</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-2">
          {filteredSections.map((section) => {
            const flexibleType = getFlexibleType(section);
            // Assign color based on courseCode if already in schedule, otherwise use a default green
            const colorIdx = courseColorMap.get(section.courseCode);
            const colorClass =
              colorIdx !== undefined
                ? COURSE_COLORS[colorIdx % COURSE_COLORS.length]
                : "bg-green-50 border-green-300 text-green-800";

            return (
              <Tooltip key={section.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleSelectSection(section)}
                    className={cn(
                      "p-2 rounded-md border-2 transition-all text-left group hover:shadow-md relative min-h-[60px]",
                      colorClass,
                      "hover:ring-2 hover:ring-green-400 hover:ring-offset-1"
                    )}
                  >
                    <div className="h-full flex flex-col">
                      <p className="font-medium text-[10px]">{section.classCode}</p>
                      <span className="font-bold text-[12px] line-clamp-1">{section.courseName}</span>
                      <div className="mt-auto flex items-center gap-1 text-[9px] opacity-70">
                        <User className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate text-[10px] font-bold">{section.lecturer}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge variant={section.isPractical ? "warning" : "info"} className="text-[8px] px-1 h-3.5">
                          {section.isPractical ? "TH" : "LT"}
                        </Badge>
                      </div>
                    </div>
                    <div className="absolute top-1 right-1 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <FlexibleClassTooltip section={section} flexibleType={flexibleType} />
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ Class Section Tooltip ============

interface ClassSectionTooltipProps {
  section: ClassSection;
}

function ClassSectionTooltip({ section }: ClassSectionTooltipProps) {
  return (
    <div className="space-y-2">
      <div>
        <h4 className="font-semibold">{section.courseName}</h4>
        <p className="text-sm text-gray-500">{section.classCode}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div className="flex items-center gap-1">
          <User className="h-4 w-4 text-gray-400" />
          <span>{section.lecturer}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-gray-400" />
          <span>Tiết {section.periods}</span>
        </div>
        {section.room && (
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4 text-gray-400" />
            <span>{section.room}</span>
          </div>
        )}
        <div>
          <Badge variant={section.isPractical ? "warning" : "info"}>
            {section.isPractical ? "Thực hành" : "Lý thuyết"}
          </Badge>
        </div>
      </div>

      {(section.startDate || section.endDate) && (
        <div className="text-xs text-gray-500 border-t pt-2">
          {section.startDate && <span>Từ: {format(section.startDate, "dd/MM/yyyy", { locale: vi })}</span>}
          {section.startDate && section.endDate && " - "}
          {section.endDate && <span>Đến: {format(section.endDate, "dd/MM/yyyy", { locale: vi })}</span>}
        </div>
      )}

      <div className="flex gap-2">
        <Badge variant="secondary">{section.credits} tín chỉ</Badge>
        {section.maxStudents && <Badge variant="outline">Sĩ số: {section.maxStudents}</Badge>}
      </div>
    </div>
  );
}

// ============ Class Detail Content (for Dialog) ============

interface ClassDetailContentProps {
  scheduledClass: ScheduledClass;
}

function ClassDetailContent({ scheduledClass }: ClassDetailContentProps) {
  const section = scheduledClass.classSection;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-lg">{section.courseName}</h4>
        <p className="text-sm text-gray-500">{section.classCode}</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <User className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-gray-500">Giảng viên</p>
            <p className="font-medium">{section.lecturer}</p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-gray-500">Thời gian</p>
            <p className="font-medium">
              {section.dayOfWeek ? DAY_NAMES[section.dayOfWeek] : "Linh hoạt"} - Tiết {section.periods}
            </p>
            {section.startPeriod && section.periodCount && (
              <p className="text-xs text-gray-500 mt-1">
                {PERIOD_TIMES[section.startPeriod]?.start} -{" "}
                {PERIOD_TIMES[section.startPeriod + section.periodCount - 1]?.end}
              </p>
            )}
          </div>
        </div>

        {section.room && (
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-gray-500">Phòng học</p>
              <p className="font-medium">{section.room}</p>
            </div>
          </div>
        )}

        {(section.startDate || section.endDate) && (
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-gray-500">Thời gian học</p>
              <p className="font-medium">
                {section.startDate && format(section.startDate, "dd/MM/yyyy", { locale: vi })}
                {section.startDate && section.endDate && " - "}
                {section.endDate && format(section.endDate, "dd/MM/yyyy", { locale: vi })}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <Badge variant={section.isPractical ? "warning" : "info"}>
          {section.isPractical ? "Thực hành" : "Lý thuyết"}
        </Badge>
        <Badge variant="secondary">{section.credits} tín chỉ</Badge>
        {section.maxStudents && <Badge variant="outline">Sĩ số: {section.maxStudents}</Badge>}
      </div>
    </div>
  );
}

export default CalendarGrid;
