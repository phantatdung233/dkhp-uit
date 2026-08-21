"use client";

/**
 * ScheduledClassCard Component
 * ============================
 * Card hiển thị thông tin một lớp học đã được xếp vào lịch
 */

import React from "react";
import { X, Clock, MapPin, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { ClassSection, ScheduledClass } from "@/types";
import { DAY_NAMES, PERIOD_TIMES } from "@/types";
import { cn } from "@/lib/utils";

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

export function ScheduledClassCard({
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

  function handleCardClick(e: React.MouseEvent): void {
    // Chỉ gọi onClick khi ở mobile và không phải click vào nút xóa
    if (isMobile && onClick && !(e.target as HTMLElement).closest("button")) {
      onClick();
    }
  }

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
          className="absolute top-1 right-1 p-0.5 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground text-muted-foreground border border-border/50 opacity-0 group-hover:opacity-100 transition-all z-20 shadow-2xs"
          title="Xóa lớp học"
        >
          <X className="h-3 w-3" />
        </button>

        {/* Content */}
        <div className="h-full flex flex-col justify-between overflow-hidden">
          <div>
            <p
              className={cn(
                "font-bold font-mono truncate opacity-90 pr-4",
                mobileCompact ? "text-[8.5px]" : "text-[10px]"
              )}
              title={section.classCode}
            >
              {section.classCode}
            </p>

            <h4
              className={cn(
                "font-bold leading-snug mt-0.5",
                mobileCompact ? "text-[10px] line-clamp-1" : "text-[12px] sm:text-[12.5px]",
                isCompact ? "line-clamp-1" : "line-clamp-2"
              )}
              title={section.courseName}
            >
              {section.courseName}
            </h4>
          </div>

          {!isCompact ? (
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
          ) : (
            <div className="mt-auto space-y-0.5 text-[9.5px] sm:text-[10.5px] leading-tight">
              <div className="flex items-center gap-1 opacity-80">
                <User className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 opacity-70" />
                <span className="font-semibold truncate">{section.lecturer || "Chưa có GV"}</span>
              </div>
              <div className="flex items-center justify-between gap-1">
                {section.room ? (
                  <div className="flex items-center gap-1 opacity-80 min-w-0">
                    <MapPin className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 opacity-70" />
                    <span className="font-semibold truncate">{section.room}</span>
                  </div>
                ) : (
                  <span />
                )}
                <span
                  className={cn(
                    "text-[7.5px] font-bold px-1 py-0.2 rounded shrink-0 leading-tight border transition-colors ml-auto",
                    section.isPractical
                      ? "bg-amber-200 text-amber-950 border-amber-400"
                      : "bg-emerald-200 text-emerald-950 border-emerald-400"
                  )}
                >
                  {section.isPractical ? "TH" : "LT"}
                </span>
              </div>
            </div>
          )}
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

// ============ Class Section Tooltip ============

interface ClassSectionTooltipProps {
  section: ClassSection;
}

export function ClassSectionTooltip({ section }: ClassSectionTooltipProps) {
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

export function ClassDetailContent({ scheduledClass }: ClassDetailContentProps) {
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
