"use client";

/**
 * Component thẻ môn học đã được xếp trên lưới lịch biểu.
 * Hỗ trợ hiển thị tooltip thông tin chi tiết và modal xem thông tin trên mobile.
 */

import React from "react";
import { X, Clock, MapPin, User, Calendar, Star } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { ClassSection, ScheduledClass } from "@/types";
import { DAY_NAMES, PERIOD_TIMES } from "@/types";
import { cn } from "@/lib/utils";
import { ProfessorRatingBadge } from "./ProfessorReviewModal";
import { getProfessorReview } from "@/lib/professor-rating";

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
    // Chỉ gọi onClick khi không phải click vào nút xóa
    if (onClick && !(e.target as HTMLElement).closest("button")) {
      onClick();
    }
  }

  const cardContent = (
    <div style={style} className={cn("pointer-events-auto group", className)}>
      <div
        onClick={handleCardClick}
        className={cn(
          "h-full w-full rounded-md border-2 overflow-hidden relative cursor-pointer",
          "shadow-xs hover:shadow-md transition-all active:scale-[0.99]",
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
              <div className="flex items-start flex-wrap gap-1 opacity-90 min-w-0">
                <User className="h-3 w-3 shrink-0 opacity-70 mt-0.5" />
                <span className="font-semibold break-words leading-tight flex-1">
                  {section.lecturer || "Chưa có GV"}
                </span>
                {section.lecturer && (
                  <ProfessorRatingBadge lecturerName={section.lecturer} size="sm" showText={false} />
                )}
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
              <div className="flex items-start flex-wrap gap-1 opacity-90 min-w-0">
                <User className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 opacity-70 mt-0.5" />
                <span className="font-semibold break-words leading-tight flex-1">
                  {section.lecturer || "Chưa có GV"}
                </span>
                {section.lecturer && (
                  <ProfessorRatingBadge lecturerName={section.lecturer} size="sm" showText={false} />
                )}
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
        <div className="flex items-center gap-1.5 col-span-2">
          <User className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="truncate">{section.lecturer}</span>
          <ProfessorRatingBadge lecturerName={section.lecturer} size="sm" />
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-gray-400 shrink-0" />
          <span>Tiết {section.periods}</span>
        </div>
        {section.room && (
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
            <span>{section.room}</span>
          </div>
        )}
        <div className="col-span-2">
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

      <div className="flex flex-wrap gap-2">
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
  const prof = getProfessorReview(section.lecturer);
  const [showAllReviews, setShowAllReviews] = React.useState(false);

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
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <p className="font-medium">{section.lecturer}</p>
              <ProfessorRatingBadge lecturerName={section.lecturer} />
            </div>
          </div>
        </div>

        {/* Khối đánh giá giảng viên nếu có */}
        {prof && prof.totalReviews > 0 && (
          <div className="p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-900 dark:text-amber-300">
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                <span>Đánh giá SV: {prof.averageRating.toFixed(1)} / 5.0</span>
                <span className="text-muted-foreground font-normal">({prof.totalReviews} nhận xét)</span>
              </div>
              {prof.reviews.length > 2 && (
                <button
                  type="button"
                  onClick={() => setShowAllReviews(!showAllReviews)}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                >
                  {showAllReviews ? "Thu gọn" : `Xem tất cả (${prof.reviews.length})`}
                </button>
              )}
            </div>

            <div className="space-y-2 pt-1 max-h-48 overflow-y-auto">
              {(showAllReviews ? prof.reviews : prof.reviews.slice(0, 2)).map((rev, rIdx) => (
                <div key={rIdx} className="p-2 rounded-md bg-white dark:bg-card border text-xs space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, sIdx) => (
                        <Star
                          key={sIdx}
                          className={cn(
                            "h-3 w-3",
                            sIdx < rev.rating ? "text-amber-500 fill-amber-400" : "text-gray-300 dark:text-gray-700"
                          )}
                        />
                      ))}
                    </div>
                    {rev.courseName && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                        {rev.courseName}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-800 dark:text-gray-200 whitespace-pre-line text-[11.5px] leading-relaxed">
                    {rev.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

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

        {(section.faculty || section.cohort) && (
          <div className="flex items-start gap-3">
            <div className="flex-1 grid grid-cols-2 gap-2 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-md border border-gray-100">
              {section.faculty && (
                <div>
                  <span className="text-gray-400">Khoa quản lý: </span>
                  <span className="font-semibold text-gray-800">{section.faculty}</span>
                </div>
              )}
              {section.cohort && (
                <div>
                  <span className="text-gray-400">Khoá học: </span>
                  <span className="font-semibold text-gray-800">{section.cohort}</span>
                </div>
              )}
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
        {section.faculty && <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200">Khoa {section.faculty}</Badge>}
        {section.cohort && <Badge variant="outline" className="bg-purple-50/50 text-purple-700 border-purple-200">K.{section.cohort}</Badge>}
      </div>
    </div>
  );
}
