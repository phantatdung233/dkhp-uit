"use client";

/**
 * Component hiển thị chi tiết đánh giá sinh viên dành cho giảng viên.
 */

import React, { useState } from "react";
import { Star, MessageSquare, BookOpen, GraduationCap, X, ChevronRight } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

import {
  getProfessorReview,
  getRatingBadgeStyle,
  type ProfessorData,
} from "@/lib/professor-rating";
import { cn } from "@/lib/utils";

// ============ Professor Rating Badge ============

interface ProfessorRatingBadgeProps {
  lecturerName: string;
  className?: string;
  size?: "sm" | "default";
  onClick?: (e: React.MouseEvent) => void;
  showText?: boolean;
}

export function ProfessorRatingBadge({
  lecturerName,
  className,
  size = "default",
  onClick,
  showText = true,
}: ProfessorRatingBadgeProps) {
  const prof = getProfessorReview(lecturerName);

  if (!prof || prof.totalReviews === 0) {
    return null;
  }

  const style = getRatingBadgeStyle(prof.averageRating);
  const isSm = size === "sm";

  return (
    <button
      type="button"
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick(e);
        }
      }}
      className={cn(
        "inline-flex items-center gap-1 font-bold rounded-md border transition-all cursor-pointer select-none",
        "hover:shadow-xs hover:scale-105 active:scale-95",
        style.bg,
        isSm ? "text-[9.5px] px-1 py-0.2 h-4" : "text-[11px] px-1.5 py-0.5 h-5",
        className
      )}
      title={`Xem ${prof.totalReviews} đánh giá từ sinh viên (Điểm: ${prof.averageRating}⭐)`}
    >
      <Star className={cn(isSm ? "h-2.5 w-2.5" : "h-3 w-3", style.star)} />
      <span>{prof.averageRating.toFixed(1)}</span>
      {showText && (
        <span className="opacity-70 font-medium text-[9px] sm:text-[10px]">
          ({prof.totalReviews})
        </span>
      )}
    </button>
  );
}

// ============ Professor Review Modal ============

interface ProfessorReviewModalProps {
  professorName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfessorReviewModal({
  professorName,
  open,
  onOpenChange,
}: ProfessorReviewModalProps) {
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("all");

  if (!professorName) return null;

  const prof = getProfessorReview(professorName);
  if (!prof) return null;

  // Lọc các môn học mà giảng viên này có review
  const taughtCourses = Array.from(
    new Set(prof.reviews.map((r) => r.courseName).filter(Boolean))
  );

  const filteredReviews =
    selectedCourseFilter === "all"
      ? prof.reviews
      : prof.reviews.filter((r) => r.courseName === selectedCourseFilter);

  const style = getRatingBadgeStyle(prof.averageRating);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b bg-gradient-to-r from-blue-500/10 via-background to-background shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                  {prof.name}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Tổng hợp đánh giá và chia sẻ kinh nghiệm từ sinh viên
              </DialogDescription>
            </div>

            {/* Rating Box */}
            <div className="flex flex-col items-end shrink-0">
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-sm shadow-xs",
                  style.bg
                )}
              >
                <Star className={cn("h-4 w-4", style.star)} />
                <span>{prof.averageRating.toFixed(1)} / 5.0</span>
              </div>
              <span className="text-[11px] text-muted-foreground mt-0.5">
                {prof.totalReviews} lượt đánh giá
              </span>
            </div>
          </div>

          {/* Course filter tags if multiple courses */}
          {taughtCourses.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pt-3 pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCourseFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border",
                  selectedCourseFilter === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted border-border"
                )}
              >
                Tất cả môn ({prof.reviews.length})
              </button>
              {taughtCourses.map((cName) => {
                const count = prof.reviews.filter((r) => r.courseName === cName).length;
                return (
                  <button
                    key={cName}
                    type="button"
                    onClick={() => setSelectedCourseFilter(cName)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border",
                      selectedCourseFilter === cName
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted border-border"
                    )}
                  >
                    {cName} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </DialogHeader>

        {/* Review list */}
        <ScrollArea className="flex-1 max-h-[60vh] p-4 sm:p-5">
          {filteredReviews.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-2">
              <MessageSquare className="h-8 w-8 mx-auto opacity-40" />
              <p className="text-sm">Chưa có nhận xét nào cho giảng viên này.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredReviews.map((review, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg border bg-card/60 hover:bg-card transition-colors space-y-2 shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, sIdx) => (
                        <Star
                          key={sIdx}
                          className={cn(
                            "h-3.5 w-3.5",
                            sIdx < review.rating
                              ? "text-amber-500 fill-amber-400"
                              : "text-gray-300 dark:text-gray-700"
                          )}
                        />
                      ))}
                      <span className="text-xs font-bold text-foreground ml-1">
                        {review.rating}.0
                      </span>
                    </div>

                    {review.courseName && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-4.5 px-2 font-medium shrink-0 max-w-[180px] truncate"
                      >
                        <BookOpen className="h-2.5 w-2.5 mr-1 shrink-0" />
                        {review.courseName}
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                    {review.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t bg-muted/20 flex items-center justify-end text-xs text-muted-foreground shrink-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProfessorReviewModal;
