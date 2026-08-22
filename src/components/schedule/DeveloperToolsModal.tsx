"use client";

/**
 * Modal Công cụ dành cho Nhà phát triển (Developer Tools).
 * Bao gồm:
 * 1. Trích xuất JSON chuẩn từ tệp Excel Thời khóa biểu.
 * 2. Tải file JSON dữ liệu đánh giá giảng viên hiện tại.
 */

import React, { useState, useRef, useMemo } from "react";
import {
  Code2,
  FileSpreadsheet,
  FileJson,
  Download,
  Copy,
  Check,
  Upload,
  Loader2,
  Database,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import { parseExcelFile } from "@/lib/parser";
import existingReviewsData from "@/data/professor-reviews.json";
import { cn } from "@/lib/utils";

interface DeveloperToolsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeveloperToolsModal({ open, onOpenChange }: DeveloperToolsModalProps) {
  const [activeTab, setActiveTab] = useState<"excel" | "reviews">("excel");

  // ================= State cho Tab 1: Trích xuất JSON từ Excel =================
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelResultJson, setExcelResultJson] = useState<string | null>(null);
  const [excelStats, setExcelStats] = useState<{
    sections: number;
    courses: number;
    fileName: string;
  } | null>(null);
  const [copiedExcel, setCopiedExcel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessExcel = async (file: File) => {
    setExcelLoading(true);
    setExcelResultJson(null);
    setExcelStats(null);

    try {
      const parsed = await parseExcelFile(file);
      if (parsed.success) {
        const jsonString = JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            fileName: file.name,
            totalSections: parsed.sections.length,
            totalCourses: parsed.courses.length,
            sections: parsed.sections,
            courses: parsed.courses,
          },
          null,
          2
        );
        setExcelResultJson(jsonString);
        setExcelStats({
          sections: parsed.sections.length,
          courses: parsed.courses.length,
          fileName: file.name,
        });
        toast.success(`Đã trích xuất thành công ${parsed.sections.length} lớp học phần`);
      } else {
        toast.error("Không thể phân tích dữ liệu Excel");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi khi đọc file Excel");
    } finally {
      setExcelLoading(false);
    }
  };

  const handleDownloadExcelJson = () => {
    if (!excelResultJson) return;
    const blob = new Blob([excelResultJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${excelStats?.fileName.replace(/\.[^/.]+$/, "") || "tkb"}-extracted.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Đã tải về tệp JSON");
  };

  const handleCopyExcelJson = () => {
    if (!excelResultJson) return;
    navigator.clipboard.writeText(excelResultJson);
    setCopiedExcel(true);
    toast.success("Đã sao chép JSON vào clipboard");
    setTimeout(() => setCopiedExcel(false), 2000);
  };

  // ================= State cho Tab 2: Dữ liệu Đánh giá Giảng viên hiện tại =================
  const [copiedReviews, setCopiedReviews] = useState(false);

  const totalProfsCount = useMemo(() => {
    return (
      (existingReviewsData as any)?.professors?.length ||
      (Array.isArray(existingReviewsData) ? existingReviewsData.length : 0)
    );
  }, []);

  const totalReviewsCount = (existingReviewsData as any)?.totalReviews || 0;

  // Tải file professor-reviews.json hiện tại
  const handleDownloadReviewsJson = () => {
    const blob = new Blob([JSON.stringify(existingReviewsData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "professor-reviews.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Đã tải về tệp JSON");
  };

  // Sao chép JSON đánh giá hiện tại
  const handleCopyReviewsJson = () => {
    navigator.clipboard.writeText(JSON.stringify(existingReviewsData, null, 2));
    setCopiedReviews(true);
    toast.success("Đã sao chép JSON vào clipboard");
    setTimeout(() => setCopiedReviews(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[92vh] flex flex-col p-0 overflow-hidden gap-0 rounded-2xl border shadow-2xl">
        {/* Top Header Banner */}
        <DialogHeader className="p-4 sm:p-5 pr-10 sm:pr-12 border-b bg-gradient-to-r from-emerald-500/10 via-primary/5 to-background shrink-0 space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                Công cụ Dành cho Nhà phát triển
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Trích xuất JSON từ Excel & Tải dữ liệu đánh giá giảng viên
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="px-4 sm:px-5 pt-3 pb-2 border-b bg-muted/10 shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-muted/70 rounded-xl max-w-sm border">
            <button
              type="button"
              onClick={() => setActiveTab("excel")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeTab === "excel"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Trích JSON từ Excel</span>
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
              <Database className="h-3.5 w-3.5" />
              <span>Dữ liệu Đánh giá GV</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <ScrollArea className="flex-1 max-h-[60vh] p-4 sm:p-5">
          {activeTab === "excel" ? (
            /* ================= Tab 1: Trích xuất JSON từ Excel ================= */
            <div className="space-y-3.5">
              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[140px]",
                  "border-border hover:border-emerald-500/60 bg-muted/20 hover:bg-muted/30",
                  excelLoading && "opacity-50 pointer-events-none"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xlsm,.xls,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProcessExcel(file);
                  }}
                  className="hidden"
                />

                <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2 shadow-xs">
                  {excelLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                </div>

                <p className="text-xs sm:text-sm font-semibold text-foreground">
                  Chọn hoặc kéo thả file Excel TKB (.xlsx, .xlsm, .csv)
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Hệ thống sẽ chuyển đổi toàn bộ môn và lớp sang cấu trúc JSON chuẩn của dự án
                </p>
              </div>

              {/* Stats & Actions when JSON is ready */}
              {excelStats && excelResultJson && (
                <div className="p-3.5 rounded-2xl border bg-card/80 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-bold text-xs sm:text-sm truncate">
                        {excelStats.fileName}
                      </span>
                    </div>
                    <Badge variant="info" className="text-[10px] font-bold">
                      Đã trích xuất
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-muted/30 border text-center">
                      <p className="text-[10.5px] text-muted-foreground font-medium">Lớp học phần</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                        {excelStats.sections} lớp
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-muted/30 border text-center">
                      <p className="text-[10.5px] text-muted-foreground font-medium">Môn học</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                        {excelStats.courses} môn
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={handleDownloadExcelJson}
                      className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Tải file JSON</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyExcelJson}
                      className="gap-1.5 text-xs font-medium"
                    >
                      {copiedExcel ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Sao chép JSON</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ================= Tab 2: Dữ liệu Đánh giá Giảng viên hiện tại ================= */
            <div className="space-y-3.5">
              <div className="p-4 rounded-2xl border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 space-y-3.5 shadow-2xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <Database className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        Tệp Dữ liệu Đánh giá Giảng viên Hiện tại
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Định dạng JSON chuẩn đã được làm sạch và tích hợp sẵn trong ứng dụng
                      </p>
                    </div>
                  </div>

                  <Badge variant="info" className="text-[10px] font-bold shrink-0">
                    Sẵn sàng
                  </Badge>
                </div>

                {/* Metrics Tiles (2 ô: Giảng viên & Tổng nhận xét) */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-background border text-center">
                    <p className="text-[10.5px] text-muted-foreground font-medium">Giảng viên</p>
                    <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                      {totalProfsCount} GV
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-background border text-center">
                    <p className="text-[10.5px] text-muted-foreground font-medium">Tổng nhận xét</p>
                    <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                      {totalReviewsCount} đánh giá
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={handleDownloadReviewsJson}
                    className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Tải file JSON</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyReviewsJson}
                    className="gap-1.5 text-xs font-medium"
                  >
                    {copiedReviews ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Sao chép JSON</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t bg-muted/20 flex items-center justify-end gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DeveloperToolsModal;
