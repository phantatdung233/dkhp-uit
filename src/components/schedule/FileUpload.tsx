"use client";

/**
 * Component tải file Excel hoặc nhập link Google Sheets để nạp dữ liệu TKB.
 * Thiết kế giao diện đồng bộ với hệ thống modal chuẩn của ứng dụng.
 */

import React, { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Link2,
  Download,
  Info,
  ExternalLink,
  Layers,
  BookOpen,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { parseExcelFile, parseGoogleSheet, validateParseResult } from "@/lib/parser";
import { useScheduleStore } from "@/store/schedule-store";
import type { ParseResult } from "@/types";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FileUpload({ open, onOpenChange }: FileUploadProps) {
  const [activeTab, setActiveTab] = useState<"file" | "sheet">("file");
  const [isLoading, setIsLoading] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { importData, allSections } = useScheduleStore();

  // Đóng modal và reset trạng thái
  const handleClose = () => {
    onOpenChange(false);
    setResult(null);
    setWarnings([]);
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setResult(null);
      setWarnings([]);
    }
  };

  // Xử lý khi chọn file từ máy tính
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  // Phân tích file Excel
  const processFile = async (file: File) => {
    setIsLoading(true);
    setResult(null);
    setWarnings([]);

    try {
      const parseResult = await parseExcelFile(file);
      setResult(parseResult);
      setWarnings(validateParseResult(parseResult));
    } catch (error) {
      setResult({
        success: false,
        sections: [],
        courses: [],
        totalRows: 0,
        errorRows: 0,
        errors: [
          {
            row: 0,
            message: error instanceof Error ? error.message : "Không thể đọc dữ liệu file",
          },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Phân tích link Google Sheet
  const handleFetchSheet = async () => {
    const trimmed = sheetUrl.trim();
    if (!trimmed) {
      toast.error("Vui lòng nhập đường dẫn Google Sheet");
      return;
    }

    setIsLoading(true);
    setResult(null);
    setWarnings([]);

    try {
      const parseResult = await parseGoogleSheet(trimmed);
      setResult(parseResult);
      setWarnings(validateParseResult(parseResult));
      if (parseResult.success) {
        toast.success(`Đã đọc thành công ${parseResult.sections.length} lớp học phần`);
      } else {
        toast.error("Có lỗi khi phân tích dữ liệu Google Sheet");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Lỗi khi tải dữ liệu từ Google Sheet";
      toast.error(msg);
      setResult({
        success: false,
        sections: [],
        courses: [],
        totalRows: 0,
        errorRows: 0,
        errors: [
          {
            row: 0,
            message: msg,
          },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Lưu dữ liệu vào store
  const handleImport = () => {
    if (result && result.sections.length > 0) {
      importData(result.sections, result.courses);
      toast.success(`Đã nạp thành công ${result.sections.length} lớp học phần vào ứng dụng`);
      handleClose();
    }
  };

  // Kéo thả file
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (
      file &&
      (file.name.endsWith(".xlsx") ||
        file.name.endsWith(".xls") ||
        file.name.endsWith(".csv") ||
        file.name.endsWith(".xlsm"))
    ) {
      await processFile(file);
    } else {
      toast.error("Vui lòng tải lên file định dạng .xlsx, .xlsm, .xls hoặc .csv");
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[92vh] flex flex-col p-0 overflow-hidden gap-0 rounded-2xl border shadow-2xl">
        {/* Top Header Banner */}
        <DialogHeader className="p-4 sm:p-5 pr-10 sm:pr-12 border-b bg-gradient-to-r from-emerald-500/10 via-primary/5 to-background shrink-0 space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-2xs">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                {result ? "Kiểm tra dữ liệu TKB" : "Nhập dữ liệu Thời Khóa Biểu"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {result
                  ? "Xem lại tổng quan các môn và lớp học phần trước khi nạp vào hệ thống"
                  : "Hỗ trợ tải tệp Excel (.xlsx, .xlsm, .csv) hoặc đồng bộ từ Google Sheets"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab switcher khi chưa có kết quả */}
        {!result && (
          <div className="px-4 sm:px-5 pt-3 pb-1 border-b bg-muted/10 shrink-0">
            <div className="flex items-center gap-1.5 p-1 bg-muted/70 rounded-xl max-w-xs border">
              <button
                type="button"
                onClick={() => setActiveTab("file")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  activeTab === "file"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Tải tệp Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("sheet")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  activeTab === "sheet"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                <Link2 className="h-3.5 w-3.5" />
                <span>Google Sheet</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <ScrollArea className="flex-1 max-h-[60vh] p-4 sm:p-5">
          {!result ? (
            <div className="space-y-4">
              {activeTab === "file" ? (
                /* Tab 1: Kéo thả file */
                <div
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[190px]",
                    dragActive
                      ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[0.99]"
                      : "border-border hover:border-emerald-500/60 bg-muted/20 hover:bg-muted/30",
                    isLoading && "opacity-50 pointer-events-none"
                  )}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xlsm,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 shadow-xs">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <Upload className="h-6 w-6" />
                    )}
                  </div>

                  <p className="text-sm font-semibold text-foreground mb-1">
                    Kéo thả file vào đây hoặc <span className="text-emerald-600 dark:text-emerald-400 hover:underline">chọn từ thiết bị</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Hỗ trợ định dạng: .xlsx, .xlsm, .xls, .csv
                  </p>
                </div>
              ) : (
                /* Tab 2: Nhập link Google Sheets */
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Link2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Đường dẫn Google Sheet TKB (chế độ chia sẻ: Bất kỳ ai có liên kết)
                    </label>
                    <div className="relative">
                      <Input
                        placeholder="https://docs.google.com/spreadsheets/d/1..."
                        value={sheetUrl}
                        onChange={(e) => setSheetUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !isLoading && sheetUrl.trim()) {
                            e.preventDefault();
                            handleFetchSheet();
                          }
                        }}
                        disabled={isLoading}
                        className="pr-9 text-xs sm:text-sm font-mono h-10 rounded-xl"
                      />
                      {sheetUrl && !isLoading && (
                        <button
                          type="button"
                          onClick={() => setSheetUrl("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-muted/30 border text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Xem file TKB mới nhất từ nhà trường:</span>
                    </div>
                    <a
                      href="https://portal.uit.edu.vn/bai-viet?q=l%E1%BB%8Bch+%C4%90KHP"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                    >
                      Cổng thông tin UIT
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <Button
                    type="button"
                    onClick={handleFetchSheet}
                    disabled={isLoading || !sheetUrl.trim()}
                    className="w-full gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Đang tải và phân tích dữ liệu...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        <span>Đồng bộ từ Google Sheet</span>
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Kết quả phân tích (Review Screen) */
            <div className="space-y-3.5">
              {/* Result Status Card */}
              <div
                className={cn(
                  "rounded-2xl p-4 border shadow-2xs space-y-3",
                  result.success
                    ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50"
                    : "bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-900/50"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                      result.success
                        ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300"
                        : "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300"
                    )}
                  >
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <AlertCircle className="h-5 w-5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4
                      className={cn(
                        "font-bold text-sm",
                        result.success
                          ? "text-emerald-900 dark:text-emerald-200"
                          : "text-red-900 dark:text-red-200"
                      )}
                    >
                      {result.success
                        ? "Đọc dữ liệu TKB thành công!"
                        : "Có lỗi khi xử lý dữ liệu"}
                    </h4>

                    {result.success ? (
                      <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
                        Dữ liệu hợp lệ và sẵn sàng để nạp vào hệ thống thời khóa biểu.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1 text-xs text-red-700 dark:text-red-400">
                        {result.errors.map((error, i) => (
                          <li key={i}>
                            {error.row > 0 && `Dòng ${error.row}: `}
                            {error.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Metrics Tiles if success */}
                {result.success && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
                    <div className="p-2.5 rounded-xl bg-white/80 dark:bg-card border text-center">
                      <p className="text-[10.5px] text-muted-foreground font-medium">Lớp học phần</p>
                      <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                        {result.sections.length}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/80 dark:bg-card border text-center">
                      <p className="text-[10.5px] text-muted-foreground font-medium">Môn học</p>
                      <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                        {result.courses.length}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/80 dark:bg-card border text-center col-span-2 sm:col-span-1">
                      <p className="text-[10.5px] text-muted-foreground font-medium">Dòng bỏ qua</p>
                      <p className="text-base font-bold text-muted-foreground">
                        {result.errorRows}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Warnings Box */}
              {result.success && warnings.length > 0 && (
                <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 overflow-hidden">
                  <div className="px-3.5 py-2 border-b border-amber-200/70 dark:border-amber-900/40 bg-amber-100/50 dark:bg-amber-900/30 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-300">
                      Cảnh báo dữ liệu ({warnings.length})
                    </p>
                  </div>
                  <div className="p-3 max-h-32 overflow-y-auto space-y-1 text-xs text-amber-800 dark:text-amber-300/90">
                    {warnings.map((w, i) => (
                      <p key={i} className="leading-tight">
                        • {w}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Notice */}
              {result.success && (
                <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Khi xác nhận nạp dữ liệu mới, toàn bộ môn học đã xếp trước đó sẽ được làm mới để đảm bảo tính đồng bộ.
                  </p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t bg-muted/20 flex items-center justify-between gap-2 shrink-0">
          <p className="text-xs text-muted-foreground font-medium">
            {allSections.length > 0 && `Đang có ${allSections.length} lớp học phần`}
          </p>

          <div className="flex items-center gap-2">
            {result ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResult(null)}
                disabled={isLoading}
                className="text-xs"
              >
                Quay lại
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={isLoading}
                className="text-xs"
              >
                Đóng
              </Button>
            )}

            {result && (
              <Button
                size="sm"
                onClick={handleImport}
                disabled={!result.success || result.sections.length === 0 || isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
              >
                Xác nhận nhập TKB
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FileUpload;
