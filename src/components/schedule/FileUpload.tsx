"use client";

/**
 * FileUpload Component
 * ====================
 * Component upload file Excel hoặc nhập link Google Sheet
 * Hỗ trợ chọn file mẫu từ server
 */

import React, { useState, useCallback, useRef } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, X, FileCheck, Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { parseExcelFile, validateParseResult } from "@/lib/parser";
import { useScheduleStore } from "@/store/schedule-store";
import type { ParseResult } from "@/types";
import { cn } from "@/lib/utils";

// Danh sách file mẫu có sẵn
const SAMPLE_FILES = [
  {
    id: "sample-1",
    name: "Lịch 2025-2026",
    description: "File lịch TKB của năm 2025-2026",
    path: "/samples/sample-2025-2026.xlsm",
  },
];

export function FileUpload() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [showSamples, setShowSamples] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { importData, allSections } = useScheduleStore();

  // Reset state when modal closes
  const handleClose = () => {
    setIsOpen(false);
    setResult(null);
    setWarnings([]);
    setShowSamples(false);
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

  // Load sample file
  const handleLoadSample = async (samplePath: string) => {
    setIsLoading(true);
    setResult(null);
    setWarnings([]);

    try {
      const response = await fetch(samplePath);
      if (!response.ok) {
        throw new Error("Không thể tải file mẫu");
      }

      const blob = await response.blob();
      const file = new File([blob], samplePath.split("/").pop() || "sample.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      await processFile(file);
      setShowSamples(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Lỗi khi tải file mẫu");
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size={allSections.length > 0 ? "icon" : "default"}
          className={allSections.length > 0 ? "" : "gap-2"}
        >
          <Upload className="h-4 w-4" />
          {allSections.length === 0 && <span>Nhập dữ liệu</span>}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {result ? "Kết quả nhập TKB" : showSamples ? "Chọn file mẫu" : "Nhập dữ liệu TKB"}
          </DialogTitle>
          <DialogDescription>
            {showSamples ? "Chọn một file lịch mẫu để sử dụng" : "Upload file Excel hoặc chọn file mẫu có sẵn"}
          </DialogDescription>
        </DialogHeader>

        {!result && !showSamples ? (
          <div className="py-4 space-y-4">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                dragActive ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300",
                isLoading && "opacity-50 pointer-events-none"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xlsm,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">Thả file vào đây</p>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  "Chọn file"
                )}
              </Button>
              <p className="text-xs text-gray-400 mt-2">Hỗ trợ: .xlsx, .xlsm, .xls, .csv</p>
              <p className="text-xs text-blue-600 mt-3">
                <a
                  href="https://daa.uit.edu.vn/thongbaochinhquy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-blue-800"
                >
                  Lấy file tại đây
                </a>
              </p>
            </div>

            {/* Sample files section */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Hoặc</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setShowSamples(true)}
              disabled={isLoading}
            >
              <FileCheck className="h-4 w-4" />
              Chọn file mẫu có sẵn
            </Button>
          </div>
        ) : !result && showSamples ? (
          <div className="py-4">
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2 pr-4">
                {SAMPLE_FILES.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => handleLoadSample(sample.path)}
                    disabled={isLoading}
                    className={cn(
                      "w-full text-left p-4 rounded-lg border-2 transition-all",
                      "hover:border-primary hover:bg-primary/5",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <FileSpreadsheet className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">{sample.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">{sample.description}</p>
                      </div>
                      <Download className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : result ? (
          <div className="py-4 space-y-3">
            {/* Success/Error Summary */}
            <div
              className={cn(
                "rounded-lg p-4 border",
                result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
              )}
            >
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}

                <div className="flex-1">
                  <h4 className={cn("font-medium", result.success ? "text-green-800" : "text-red-800")}>
                    {result.success ? "Đọc file thành công!" : "Có lỗi xảy ra"}
                  </h4>

                  {result.success ? (
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-green-700">
                      <p>
                        • Lớp học: <span className="font-bold">{result.sections.length}</span> lớp
                      </p>
                      <p>
                        • Môn học: <span className="font-bold">{result.courses.length}</span> môn
                      </p>
                      {result.errorRows > 0 && (
                        <p className="text-amber-700">
                          • Lỗi: <span className="font-bold">{result.errorRows}</span> dòng
                        </p>
                      )}
                    </div>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm text-red-700">
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
              <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 overflow-hidden">
                <div className="px-4 py-2 border-b border-yellow-200 bg-yellow-100/50 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-700" />
                  <p className="text-sm font-bold text-yellow-800">Cảnh báo ({warnings.length})</p>
                </div>
                <ScrollArea className="h-[150px]">
                  <div className="px-4 py-2">
                    <ul className="text-sm text-yellow-700 space-y-1.5 pb-2">
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
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-xs text-gray-500">{allSections.length > 0 && <>Hiện tại: {allSections.length} lớp</>}</p>
          <div className="flex gap-2">
            {result ? (
              <Button variant="outline" onClick={() => setResult(null)}>
                Quay lại
              </Button>
            ) : showSamples ? (
              <Button variant="outline" onClick={() => setShowSamples(false)}>
                Quay lại
              </Button>
            ) : (
              <Button variant="outline" onClick={handleClose}>
                Hủy
              </Button>
            )}
            {result && (
              <Button onClick={handleImport} disabled={!result.success || result.sections.length === 0}>
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
