"use client";

/**
 * Component tải file Excel hoặc nhập link Google Sheets để nạp dữ liệu TKB.
 */

import React, { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  Link2,
  Download,
  Info,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  const [isLoading, setIsLoading] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { importData, allSections } = useScheduleStore();

  // Reset state when modal closes
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

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  // Process uploaded file
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
            message: error instanceof Error ? error.message : "Unknown error",
          },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Process Google Sheet URL
  const handleFetchSheet = async () => {
    const trimmed = sheetUrl.trim();
    if (!trimmed) {
      toast.error("Vui lòng nhập đường link Google Sheet");
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
      const msg = error instanceof Error ? error.message : "Lỗi khi tải Google Sheet";
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

  // Import data to store
  const handleImport = () => {
    if (result && result.sections.length > 0) {
      importData(result.sections, result.courses);
      toast.success(`Đã nhập thành công ${result.sections.length} lớp học phần`);
      handleClose();
    }
  };

  // Drag and drop handlers
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
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {result ? "Kết quả nhập TKB" : "Nhập dữ liệu TKB"}
          </DialogTitle>
          <DialogDescription>
            {result
              ? "Kiểm tra thông tin trước khi áp dụng vào thời khóa biểu"
              : "Tải file Excel (.xlsx, .xlsm, .xls, .csv) hoặc nhập link GG Sheet"}
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="py-2 space-y-4">
            {/* File Dropzone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 bg-muted/20",
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

              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                Kéo thả file vào đây hoặc <span className="text-primary hover:underline">chọn file</span>
              </p>
              <p className="text-xs text-muted-foreground">Hỗ trợ: .xlsx, .xlsm, .xls, .csv</p>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground font-medium">Hoặc</span>
              </div>
            </div>

            {/* Google Sheet URL Section */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="https://docs.google.com/spreadsheets/d/1dQbqHh..."
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isLoading && sheetUrl.trim()) {
                        e.preventDefault();
                        handleFetchSheet();
                      }
                    }}
                    disabled={isLoading}
                    className="pl-9 pr-8"
                  />
                  {sheetUrl && !isLoading && (
                    <button
                      type="button"
                      onClick={() => setSheetUrl("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={handleFetchSheet}
                  disabled={isLoading || !sheetUrl.trim()}
                  className="gap-2 shrink-0"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />

                    </>
                  )}
                </Button>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-md border border-border/50">
                <Info className="h-4 w-4 text-primary shrink-0" />
                <span>
                  Lấy link Google Sheet tại đây:{" "}
                  <a
                    href="https://portal.uit.edu.vn/bai-viet?q=l%E1%BB%8Bch+%C4%90KHP"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                  >
                    Cổng thông tin UIT
                    <ExternalLink className="h-3 w-3 inline" />
                  </a>
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-3">
            {/* Success/Error Summary */}
            <div
              className={cn(
                "rounded-lg p-4 border",
                result.success ? "bg-green-50/80 border-green-200 dark:bg-green-950/30 dark:border-green-900" : "bg-red-50/80 border-red-200 dark:bg-red-950/30 dark:border-red-900"
              )}
            >
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <h4 className={cn("font-medium", result.success ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300")}>
                    {result.success ? "Đọc dữ liệu thành công!" : "Có lỗi xảy ra khi đọc dữ liệu"}
                  </h4>

                  {result.success ? (
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-green-700 dark:text-green-400">
                      <p>
                        • Lớp học: <span className="font-bold">{result.sections.length}</span> lớp
                      </p>
                      <p>
                        • Môn học: <span className="font-bold">{result.courses.length}</span> môn
                      </p>
                      {result.errorRows > 0 && (
                        <p className="text-amber-700 dark:text-amber-400">
                          • Lỗi bỏ qua: <span className="font-bold">{result.errorRows}</span> dòng
                        </p>
                      )}
                    </div>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-400">
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
            </div>

            {/* Warnings - Separate Box with Scroll */}
            {result.success && warnings.length > 0 && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 dark:border-yellow-900/50 dark:bg-yellow-950/20 overflow-hidden">
                <div className="px-4 py-2 border-b border-yellow-200 dark:border-yellow-900/50 bg-yellow-100/50 dark:bg-yellow-900/30 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-700 dark:text-yellow-400" />
                  <p className="text-sm font-bold text-yellow-800 dark:text-yellow-300">Cảnh báo ({warnings.length})</p>
                </div>
                <ScrollArea className="h-[120px]">
                  <div className="px-4 py-2">
                    <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1.5 pb-2">
                      {warnings.map((warning, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-yellow-500 shrink-0">•</span>
                          <span>{warning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Notice about clearing old schedules */}
            {result.success && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/40 p-3 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Lưu ý:</p>
                  <p className="text-amber-800 dark:text-amber-300">
                    Toàn bộ các lớp đã xếp ở các lịch hiện tại sẽ được xóa để đồng bộ với dữ liệu mới.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-xs text-muted-foreground">{allSections.length > 0 && <>Hiện tại: {allSections.length} lớp</>}</p>
          <div className="flex gap-2">
            {result ? (
              <Button variant="outline" onClick={() => setResult(null)} disabled={isLoading}>
                Quay lại
              </Button>
            ) : (
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                Đóng
              </Button>
            )}
            {result && (
              <Button onClick={handleImport} disabled={!result.success || result.sections.length === 0 || isLoading}>
                Nhập
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FileUpload;
