"use client";

import React, { useMemo, useState } from "react";
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Camera,
  Copy,
  Info,
  Download,
  FileText,
  ExternalLink,
  Settings,
  Upload,
  Sparkles,
} from "lucide-react";

import { SchedulePlanner, FileUpload, ScheduleManager, AutoScheduleModal, ImportClassCodesModal } from "@/components/schedule";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useScheduleStore } from "@/store/schedule-store";
import { useScheduleActions } from "@/hooks/useScheduleActions";
import { cn } from "@/lib/utils";

export default function Home() {
  const { allSections, allCourses, totalCredits, scheduledClasses } = useScheduleStore();

  const theoryCredits = scheduledClasses
    .filter((sc) => !sc.classSection.isPractical)
    .reduce((sum, sc) => sum + (sc.classSection.credits || 0), 0);
  const practicalCredits = scheduledClasses
    .filter((sc) => sc.classSection.isPractical)
    .reduce((sum, sc) => sum + (sc.classSection.credits || 0), 0);

  const {
    showClearConfirm,
    setShowClearConfirm,
    forceFullCalendar,
    showImportDialog,
    setShowImportDialog,
    importClassCodes,
    setImportClassCodes,
    importErrors,
    setImportErrors,
    hasSchedule,
    handleExportCoursesCodes,
    handleImportCoursesCodes,
    handleConfirmImport,
    handleClearSchedule,
    handleExportImage,
  } = useScheduleActions();

  const [showAutoScheduleModal, setShowAutoScheduleModal] = useState(false);
  const [showFileUploadModal, setShowFileUploadModal] = useState(false);
  const hasData = allSections.length > 0;

  return (
    <TooltipProvider delayDuration={0}>
      <main className="h-screen flex flex-col bg-gray-100">
        {/* Header */}
        <header className="bg-white border-b shadow-xs sticky top-0 z-50">
          <div className="px-2 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 sm:gap-2 safe-area-inset-top">
            {/* Left side: Logo */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <h1 className="text-sm sm:text-base md:text-lg font-bold whitespace-nowrap">
                <span className="text-[#4299e3]">UIT</span>
                <span className="text-gray-400 mx-0.5 sm:mx-1">-</span>
                <span className="text-[#38b2ac]">ĐKHP</span>
              </h1>
            </div>

            {/* Right side: Credits + Schedule Manager + Actions */}
            <div className="flex items-center gap-1 sm:gap-2 ml-auto min-w-0 justify-end">
              {/* Credits Badge */}
              {hasData && (
                <div className="flex items-center gap-1 border-r pr-1 sm:pr-2 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md transition-all cursor-help shadow-2xs",
                          totalCredits < 14 && "bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100",
                          totalCredits >= 14 &&
                          totalCredits <= 24 &&
                          "bg-green-50 text-green-700 border border-green-300 hover:bg-green-100",
                          totalCredits > 24 &&
                          totalCredits <= 30 &&
                          "bg-orange-50 text-orange-700 border border-orange-300 hover:bg-orange-100",
                          totalCredits > 30 && "bg-red-50 text-red-700 border border-red-300 hover:bg-red-100"
                        )}
                      >
                        {totalCredits < 14 ? (
                          <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        ) : totalCredits <= 24 ? (
                          <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        ) : (
                          <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        )}
                        <div className="flex flex-col">
                          <span className="text-[10px] sm:text-xs font-bold leading-tight whitespace-nowrap">
                            {totalCredits} TC
                          </span>
                          <span className="text-[8px] sm:text-[9px] opacity-70 leading-tight hidden md:block whitespace-nowrap">
                            {totalCredits < 14
                              ? "Còn Thiếu"
                              : totalCredits <= 24
                                ? "Hợp lệ"
                                : totalCredits <= 30
                                  ? "Cần GPA > 8.0"
                                  : "Vượt quá"}
                          </span>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <div className="space-y-2 text-xs">
                        <div className="flex flex-col gap-1 border-b pb-1.5 mb-1.5 font-medium">
                          <div className="flex justify-between">
                            <span>Lý thuyết:</span>
                            <span>{theoryCredits} TC</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Thực hành:</span>
                            <span>{practicalCredits} TC</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t mt-1 font-bold text-blue-600">
                            <span>Tổng cộng:</span>
                            <span>{totalCredits} TC</span>
                          </div>
                        </div>
                        <p className="font-bold border-b pb-1.5 mb-1.5">Quy định đăng ký tín chỉ:</p>
                        <div className="space-y-1">
                          <div className="flex justify-between gap-4">
                            <span>Quy định:</span>
                            <span className="font-semibold text-green-600">14 - 24 TC</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>GPA {"> "} 8.0:</span>
                            <span className="font-semibold text-orange-600">25 - 30 TC</span>
                          </div>
                        </div>
                        {totalCredits < 14 && (
                          <p className="text-amber-600 font-medium pt-1.5 border-t mt-1.5">
                            ⚠️ Chưa đủ số tín chỉ tối thiểu (14 TC)
                          </p>
                        )}
                        {totalCredits > 24 && totalCredits <= 30 && (
                          <p className="text-orange-600 font-medium pt-1.5 border-t mt-1.5">
                            ℹ️ Đăng ký trên 24 TC yêu cầu GPA {"> "} 8.0
                          </p>
                        )}
                        {totalCredits > 30 && (
                          <p className="text-red-600 font-medium pt-1.5 border-t mt-1.5">
                            ❌ Vượt quá giới hạn tối đa (30 TC)
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}

              {/* Auto Schedule Button */}
              {hasData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAutoScheduleModal(true)}
                  className="h-8 sm:h-9 px-2 sm:px-3 gap-1 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold shadow-2xs"
                  title="Sắp xếp nhanh thời khóa biểu theo mã môn"
                >
                  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden md:inline">Sắp xếp nhanh</span>
                  <span className="hidden xs:inline md:hidden">Sắp xếp</span>
                </Button>
              )}

              {/* Import TKB Button */}
              <Button
                data-file-upload-trigger
                variant="outline"
                size="sm"
                onClick={() => setShowFileUploadModal(true)}
                className="h-8 sm:h-9 px-2 sm:px-3 gap-1 font-medium shadow-2xs"
                title="Nhập dữ liệu thời khóa biểu từ Excel hoặc Google Sheets"
              >
                <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Nhập TKB</span>
                <span className="hidden xs:inline sm:hidden">Nhập</span>
              </Button>

              {/* Schedule Manager */}
              {hasData && (
                <div className="flex items-center min-w-0 shrink">
                  <ScheduleManager />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Settings Dropdown */}
                <DropdownMenu>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Cài đặt & Chức năng</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <DropdownMenuContent align="end" className="w-56">
                    {/* Auto schedule item */}
                    <DropdownMenuItem
                      onClick={() => setShowAutoScheduleModal(true)}
                      disabled={!hasData}
                      className="text-emerald-700 dark:text-emerald-300 font-medium focus:text-emerald-700 focus:bg-emerald-500/10"
                    >
                      <Sparkles className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Sắp xếp nhanh</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Data Import/Export Section */}
                    <DropdownMenuLabel>Dữ liệu</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setShowFileUploadModal(true)}>
                      <Upload className="mr-2 h-4 w-4" />
                      <span>Nhập dữ liệu TKB</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Class Codes Section */}
                    <DropdownMenuLabel>Mã lớp</DropdownMenuLabel>
                    <DropdownMenuItem onClick={handleExportCoursesCodes} disabled={!hasSchedule}>
                      <Copy className="mr-2 h-4 w-4" />
                      <span>Xuất mã lớp</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={handleImportCoursesCodes} disabled={!hasData}>
                      <Download className="mr-2 h-4 w-4" />
                      <span>Nhập mã lớp</span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Export Image Section */}
                    <DropdownMenuLabel>Xuất ảnh</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleExportImage("download")} disabled={!hasSchedule}>
                      <Camera className="mr-2 h-4 w-4" />
                      <span>Tải ảnh TKB</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => handleExportImage("copy")} disabled={!hasSchedule}>
                      <FileText className="mr-2 h-4 w-4" />
                      <span>Sao chép ảnh TKB</span>
                    </DropdownMenuItem>

                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        {/* FileUpload modal */}
        <FileUpload
          open={showFileUploadModal}
          onOpenChange={setShowFileUploadModal}
        />

        {/* Auto Schedule Modal */}
        <AutoScheduleModal
          open={showAutoScheduleModal}
          onOpenChange={setShowAutoScheduleModal}
        />

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          <SchedulePlanner forceFullCalendar={forceFullCalendar} />
        </div>

        {/* Clear schedule confirmation dialog */}
        <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <DialogContent className="w-[92vw] sm:max-w-md p-0 overflow-hidden rounded-2xl border shadow-2xl">
            <DialogHeader className="p-4 sm:p-5 pr-10 sm:pr-12 border-b bg-gradient-to-r from-red-500/10 via-destructive/5 to-background space-y-1">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Xác nhận xóa thời khóa biểu
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Hành động này sẽ xóa toàn bộ các lớp đã xếp ở phương án hiện tại
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="p-4 sm:p-5 text-xs text-muted-foreground leading-relaxed">
              Bạn có chắc chắn muốn xóa tất cả các môn học đã xếp? Dữ liệu lịch này không thể khôi phục sau khi xóa.
            </div>

            <div className="p-3.5 sm:p-4 border-t bg-muted/20 flex items-center justify-end gap-2.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearConfirm(false)}
                className="text-xs"
              >
                Hủy
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearSchedule}
                className="gap-1.5 font-semibold text-xs shadow-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Xóa lịch
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import class codes modal */}
        <ImportClassCodesModal
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onImport={(codes) => handleConfirmImport(codes)}
        />
      </main>
    </TooltipProvider>
  );
}
