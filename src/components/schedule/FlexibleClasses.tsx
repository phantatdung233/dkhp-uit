"use client";

/**
 * Các component hiển thị và quản lý lớp học có thời gian linh hoạt (không cố định thứ/tiết).
 */

import React from "react";
import { X, Clock, MapPin, User, Calendar, Plus } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useScheduleStore } from "@/store/schedule-store";
import { getConflictingScheduledClasses } from "@/store/schedule-store-helpers";
import type { ClassSection, ScheduledClass } from "@/types";
import { DAY_NAMES, COURSE_COLORS } from "@/types";
import { cn } from "@/lib/utils";

interface FlexibleClassesListProps {
  classes: ScheduledClass[];
  onRemove: (id: string) => void;
  onClassClick?: (scheduledClass: ScheduledClass) => void;
}

export function FlexibleClassesList({ classes, onRemove, onClassClick }: FlexibleClassesListProps) {
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
  function getFlexibleType(section: ClassSection): string {
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
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5 p-2 sm:p-3">
      {classes.map((scheduledClass) => {
        const section = scheduledClass.classSection;
        const colorIdx = courseColorMap.get(section.courseCode) || 0;
        const colorClass = COURSE_COLORS[colorIdx % COURSE_COLORS.length];
        const flexibleType = getFlexibleType(section);

        function handleFlexibleCardClick(e: React.MouseEvent): void {
          // Chỉ xử lý click trên mobile, bỏ qua nếu click vào nút xóa
          if (onClassClick && !(e.target as HTMLElement).closest("button")) {
            onClassClick(scheduledClass);
          }
        }

        // Nội dung card dùng chung
        const cardInnerContent = (
          <>
            {/* Remove button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(scheduledClass.id);
              }}
              className="absolute top-1 right-1 p-0.5 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground text-muted-foreground border border-border/50 opacity-0 group-hover:opacity-100 transition-all z-20 shadow-2xs"
              title="Xóa lớp học"
            >
              <X className="h-3 w-3" />
            </button>

            {/* Content */}
            <div className="h-full flex flex-col justify-between overflow-hidden">
              <div>
                <p className="font-bold font-mono text-[10px] truncate opacity-90 pr-4">{section.classCode}</p>
                <h4 className="font-bold leading-snug text-[12px] sm:text-[12.5px] mt-0.5 line-clamp-1">
                  {section.courseName}
                </h4>
              </div>

              <div className="mt-1 space-y-0.5 text-[10.5px] sm:text-[11px] leading-tight">
                <div className="flex items-center gap-1 opacity-80">
                  <User className="h-3 w-3 shrink-0 opacity-70" />
                  <span className="font-semibold truncate">{section.lecturer || "Chưa có GV"}</span>
                </div>
                {section.room && (
                  <div className="flex items-center gap-1 opacity-80">
                    <MapPin className="h-3 w-3 shrink-0 opacity-70" />
                    <span className="font-semibold truncate">{section.room}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-1 border-t border-current/10 pt-0.5 mt-0.5">
                  {(section.startDate || section.endDate) ? (
                    <div className="flex items-center gap-1 opacity-70 text-[9.5px] min-w-0">
                      <Calendar className="h-2.5 w-2.5 shrink-0 opacity-70" />
                      <span className="truncate">
                        {section.startDate ? format(section.startDate, "dd/MM") : "?"} -{" "}
                        {section.endDate ? format(section.endDate, "dd/MM") : "?"}
                      </span>
                    </div>
                  ) : (
                    <span />
                  )}
                  <span
                    className={cn(
                      "text-[8px] font-bold px-1 py-0.2 rounded shrink-0 leading-tight border transition-colors ml-auto",
                      section.isPractical
                        ? "bg-amber-200 text-amber-950 border-amber-400"
                        : "bg-emerald-200 text-emerald-950 border-emerald-400"
                    )}
                  >
                    {section.isPractical ? "TH" : "LT"}
                  </span>
                </div>
              </div>
            </div>
          </>
        );

        return (
          <React.Fragment key={scheduledClass.id}>
            {/* Desktop: với tooltip, KHÔNG có click */}
            <div className="hidden md:block group relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "h-full min-h-[70px] rounded-md border p-1.5 overflow-hidden relative",
                      "shadow-2xs hover:shadow-sm hover:brightness-[1.02] dark:hover:brightness-110 transition-all cursor-default",
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
            <div className="md:hidden group relative">
              <div
                onClick={handleFlexibleCardClick}
                className={cn(
                  "h-full min-h-[70px] rounded-md border p-1.5 overflow-hidden relative cursor-pointer",
                  "shadow-2xs hover:shadow-sm hover:brightness-[1.02] dark:hover:brightness-110 transition-all",
                  colorClass
                )}
              >
                {cardInnerContent}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ============ Flexible Class Tooltip ============

interface FlexibleClassTooltipProps {
  section: ClassSection;
  flexibleType: string;
}

export function FlexibleClassTooltip({ section, flexibleType }: FlexibleClassTooltipProps) {
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

export function FlexibleSectionSelector({ sections }: FlexibleSectionSelectorProps) {
  const { addClassToSchedule, clickSelectedLecturer, scheduledClasses, replaceClassWithSection } = useScheduleStore();

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

  function handleSelectSection(section: ClassSection): void {
    const conflictingClasses = getConflictingScheduledClasses(section, scheduledClasses);
    if (conflictingClasses.length > 0) {
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
      toast.success(`Đã thêm ${section.courseName} vào lịch linh hoạt`);
    }
  }

  // Xác định loại flexible
  function getFlexibleType(section: ClassSection): string {
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
  }

  if (filteredSections.length === 0) return null;

  return (
    <div className="bg-green-50 border-t-2 border-green-200">
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-green-700">{filteredSections.length} Lựa Chọn</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5">
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
