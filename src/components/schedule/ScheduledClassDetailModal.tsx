"use client";

/**
 * Modal hiển thị thông tin chi tiết và đánh giá giảng viên khi bấm vào một môn học trên lịch.
 */

import React, { useState } from "react";
import {
  User,
  Clock,
  MapPin,
  Users,
  Trash2,
  Copy,
  Check,
  Star,
  BookOpen,
  CalendarDays,
  MessageSquareQuote,
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import { getProfessorReview, getRatingBadgeStyle } from "@/lib/professor-rating";
import type { ScheduledClass } from "@/types";
import { DAY_NAMES, PERIOD_TIMES } from "@/types";
import { cn } from "@/lib/utils";

interface ScheduledClassDetailModalProps {
  scheduledClass: ScheduledClass | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: (id: string) => void;
}

export function ScheduledClassDetailModal({
  scheduledClass,
  open,
  onOpenChange,
  onRemove,
}: ScheduledClassDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "reviews">("info");

  if (!scheduledClass) return null;

  const section = scheduledClass.classSection;
  const prof = getProfessorReview(section.lecturer);
  const hasReviews = Boolean(prof && prof.totalReviews > 0);
  const ratingStyle = prof ? getRatingBadgeStyle(prof.averageRating) : null;

  // Xử lý sao chép mã lớp
  const handleCopyCode = () => {
    if (section.classCode) {
      navigator.clipboard.writeText(section.classCode);
      setCopied(true);
      toast.success(`Đã sao chép mã lớp: ${section.classCode}`);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Tính giờ học thực tế
  const periodTimeRange =
    section.startPeriod && section.periodCount
      ? {
          start: PERIOD_TIMES[section.startPeriod]?.start || "",
          end:
            PERIOD_TIMES[section.startPeriod + section.periodCount - 1]?.end || "",
        }
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[92vh] flex flex-col p-0 overflow-hidden gap-0 rounded-2xl border shadow-2xl">
        {/* Top Header Banner với khoảng đệm pr-9 để tránh đè nút X đóng modal */}
        <DialogHeader className="p-4 sm:p-5 pr-10 sm:pr-12 border-b bg-gradient-to-r from-emerald-500/10 via-primary/5 to-background shrink-0 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={section.isPractical ? "warning" : "info"}
                  className="text-[10px] font-bold px-2 py-0.5"
                >
                  {section.isPractical ? "Thực hành" : "Lý thuyết"}
                </Badge>

                <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5">
                  {section.credits} Tín chỉ
                </Badge>

                {section.faculty && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-medium bg-blue-50/70 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                  >
                    Khoa {section.faculty}
                  </Badge>
                )}

                {section.cohort && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-medium bg-purple-50/70 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                  >
                    Khoá {section.cohort}
                  </Badge>
                )}
              </div>

              <DialogTitle className="text-base sm:text-lg font-bold text-foreground leading-snug pt-1">
                {section.courseName}
              </DialogTitle>
            </div>

            {/* Quick copy class code button */}
            <button
              type="button"
              onClick={handleCopyCode}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold transition-all shrink-0 cursor-pointer",
                copied
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border shadow-2xs"
              )}
              title="Nhấn để sao chép mã lớp"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Đã chép</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>{section.classCode}</span>
                </>
              )}
            </button>
          </div>
        </DialogHeader>

        {/* Tab Navigation Switcher */}
        <div className="px-4 sm:px-5 pt-3 pb-2 border-b bg-muted/10 shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-muted/70 rounded-xl max-w-xs border">
            <button
              type="button"
              onClick={() => setActiveTab("info")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeTab === "info"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Thông tin lớp</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("reviews")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeTab === "reviews"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <MessageSquareQuote className="h-3.5 w-3.5" />
              <span>Đánh giá GV</span>
              {hasReviews && prof && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-white">
                  {prof.totalReviews}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <ScrollArea className="flex-1 max-h-[58vh] p-4 sm:p-5">
          {activeTab === "info" ? (
            <div className="space-y-3.5">
              {/* Key Tiles Grid - Tất cả icon đều đồng bộ màu xanh lá */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Lecturer Tile */}
                <div className="p-3 rounded-xl border bg-card/80 shadow-2xs flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Giảng viên giảng dạy
                    </p>
                    <p className="font-bold text-sm text-foreground truncate mt-0.5">
                      {section.lecturer || "Chưa có thông tin"}
                    </p>
                    {hasReviews && prof ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab("reviews")}
                        className={cn(
                          "inline-flex items-center gap-1 mt-1.5 text-[10.5px] font-bold px-1.5 py-0.5 rounded border transition-all cursor-pointer",
                          ratingStyle?.bg
                        )}
                      >
                        <Star className={cn("h-3 w-3", ratingStyle?.star)} />
                        <span>{prof.averageRating.toFixed(1)} / 5.0</span>
                        <span className="opacity-70 font-normal">
                          ({prof.totalReviews} đánh giá)
                        </span>
                      </button>
                    ) : (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Chưa có đánh giá
                      </p>
                    )}
                  </div>
                </div>

                {/* 2. Schedule & Time Tile */}
                <div className="p-3 rounded-xl border bg-card/80 shadow-2xs flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Thời gian học
                    </p>
                    <p className="font-bold text-sm text-foreground mt-0.5">
                      {section.dayOfWeek
                        ? DAY_NAMES[section.dayOfWeek]
                        : "Lịch linh hoạt"}
                      {" - "}Tiết {section.periods}
                    </p>
                    {periodTimeRange && (
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        {periodTimeRange.start} → {periodTimeRange.end}
                      </p>
                    )}
                  </div>
                </div>

                {/* 3. Room & Students Tile */}
                <div className="p-3 rounded-xl border bg-card/80 shadow-2xs flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Phòng học & Sĩ số
                    </p>
                    <p className="font-bold text-sm text-foreground mt-0.5">
                      Phòng:{" "}
                      <span className="font-mono text-primary font-bold">
                        {section.room || "Chưa có"}
                      </span>
                    </p>
                    {section.maxStudents && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Sĩ số tối đa: {section.maxStudents} SV
                      </p>
                    )}
                  </div>
                </div>

                {/* 4. Semester Date Range Tile */}
                <div className="p-3 rounded-xl border bg-card/80 shadow-2xs flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Thời lượng học kỳ
                    </p>
                    <p className="font-bold text-xs sm:text-sm text-foreground mt-0.5">
                      {section.startDate
                        ? format(section.startDate, "dd/MM/yyyy", { locale: vi })
                        : "Chưa rõ"}
                      {" → "}
                      {section.endDate
                        ? format(section.endDate, "dd/MM/yyyy", { locale: vi })
                        : "Chưa rõ"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Tab 2: Reviews from Students */
            <div className="space-y-3">
              {hasReviews && prof ? (
                <>
                  {/* Rating summary bar */}
                  <div
                    className={cn(
                      "p-3.5 rounded-xl border flex items-center justify-between shadow-2xs",
                      ratingStyle?.bg
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-base">
                        <Star className={cn("h-4 w-4", ratingStyle?.star)} />
                        <span>{prof.averageRating.toFixed(1)} / 5.0</span>
                      </div>
                      <p className="text-xs opacity-80 mt-0.5">
                        Dựa trên {prof.totalReviews} nhận xét từ sinh viên UIT
                      </p>
                    </div>

                    <div className="text-right text-xs">
                      <p className="font-bold text-foreground">{prof.name}</p>
                    </div>
                  </div>

                  {/* List of reviews */}
                  <div className="space-y-2.5">
                    {prof.reviews.map((rev, rIdx) => (
                      <div
                        key={rIdx}
                        className="p-3 rounded-xl border bg-card/80 space-y-2 shadow-2xs hover:bg-card transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, sIdx) => (
                              <Star
                                key={sIdx}
                                className={cn(
                                  "h-3 w-3",
                                  sIdx < rev.rating
                                    ? "text-amber-500 fill-amber-400"
                                    : "text-gray-300 dark:text-gray-700"
                                )}
                              />
                            ))}
                            <span className="text-xs font-bold ml-1">
                              {rev.rating}.0
                            </span>
                          </div>

                          {rev.courseName && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] h-4.5 px-2 font-medium shrink-0 max-w-[180px] truncate"
                            >
                              <BookOpen className="h-2.5 w-2.5 mr-1 shrink-0" />
                              {rev.courseName}
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                          {rev.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-muted-foreground space-y-2">
                  <MessageSquareQuote className="h-10 w-10 mx-auto opacity-30" />
                  <p className="text-sm font-medium">
                    Chưa có đánh giá nào cho giảng viên {section.lecturer || "này"}.
                  </p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer Actions: Đóng và Xóa đều nằm cùng bên phải, nút Xóa nằm bên phải nút Đóng */}
        <div className="p-3.5 sm:p-4 border-t bg-muted/20 flex items-center justify-end gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Đóng
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onRemove(scheduledClass.id);
              onOpenChange(false);
              toast.success(`Đã xóa "${section.courseName}" khỏi lịch`);
            }}
            className="gap-1.5 font-semibold text-xs shadow-xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xóa khỏi lịch
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ScheduledClassDetailModal;
