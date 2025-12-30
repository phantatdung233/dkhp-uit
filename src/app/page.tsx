"use client";

import React, { useMemo, useState } from "react";
import { Trash2, AlertTriangle, CheckCircle2, Camera, Copy, Info, Download, FileText } from "lucide-react";

import { SchedulePlanner, FileUpload, ScheduleManager } from "@/components/schedule";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { cn } from "@/lib/utils";
import { toPng } from "html-to-image";
import { toast } from "sonner";

export default function Home() {
  const {
    allSections,
    allCourses,
    scheduledClasses,
    totalCredits,
    clearSchedule,
    clearData,
    filterOptions,
    setFilterOptions,
    addClassToSchedule,
  } = useScheduleStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [forceFullCalendar, setForceFullCalendar] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importClassCodes, setImportClassCodes] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const hasData = allSections.length > 0;
  const hasSchedule = scheduledClasses.length > 0;

  const handleExportCoursesCodes = () => {
    const classCodes = scheduledClasses
      .map((sc) => sc.classSection.classCode)
      .sort()
      .join(",");

    if (!classCodes) {
      toast.error("Chưa có lớp nào để xuất");
      return;
    }

    navigator.clipboard.writeText(classCodes);
    toast.success(`Đã sao chép ${scheduledClasses.length} mã lớp`);
  };

  const handleImportCoursesCodes = () => {
    setImportClassCodes("");
    setImportErrors([]);
    setShowImportDialog(true);
  };

  const handleConfirmImport = () => {
    if (!importClassCodes.trim()) {
      toast.error("Vui lòng nhập mã lớp");
      return;
    }

    const codes = importClassCodes
      .split(",")
      .map((code) => code.trim())
      .filter((code) => code);

    if (codes.length === 0) {
      toast.error("Không có mã lớp hợp lệ");
      return;
    }

    const errors: string[] = [];
    const addedClasses: string[] = [];
    const skippedClasses: string[] = [];

    // Xử lý từng mã lớp
    codes.forEach((code) => {
      // Tìm class section từ mã lớp
      const section = allSections.find((s) => s.classCode === code);

      if (!section) {
        errors.push(`Không tìm thấy lớp "${code}"`);
        return;
      }

      // Kiểm tra đã đăng ký chưa
      const alreadyRegistered = scheduledClasses.some((sc) => sc.classSection.classCode === code);
      if (alreadyRegistered) {
        skippedClasses.push(code);
        return;
      }

      // Nếu là lớp lý thuyết, kiểm tra xem có lớp thực hành không
      if (!section.isPractical) {
        const practicalSections = allSections.filter(
          (s) => s.courseCode === section.courseCode && s.isPractical && s.classCode.startsWith(section.classCode + ".")
        );

        if (practicalSections.length > 0) {
          // Kiểm tra xem người dùng có nhập lớp TH nào không
          const hasPracticalInInput = practicalSections.some((ps) => codes.includes(ps.classCode));

          if (!hasPracticalInInput) {
            const practicalCodes = practicalSections.map((s) => s.classCode).join(", ");
            errors.push(`Lớp "${code}": Cần nhập thêm lớp thực hành (VD: ${practicalSections[0].classCode})`);
            return;
          }
        }
      }

      // Thêm vào lịch với kiểm tra conflict
      const result = addClassToSchedule(section, true); // skipPracticalPrompt = true

      if (result.success) {
        addedClasses.push(code);
      } else {
        if (result.conflicts && result.conflicts.length > 0) {
          errors.push(`Lớp "${code}": Trùng lịch với ${result.conflicts[0].conflictingClasses[0].classCode}`);
        } else if (result.error) {
          errors.push(`Lớp "${code}": ${result.error}`);
        }
      }
    });

    // Hiển thị kết quả
    if (addedClasses.length > 0) {
      toast.success(`Đã thêm ${addedClasses.length} lớp vào lịch`);
    }

    if (skippedClasses.length > 0) {
      toast.info(`Bỏ qua ${skippedClasses.length} lớp đã đăng ký`);
    }

    if (errors.length > 0) {
      setImportErrors(errors);
      return; // Giữ dialog mở để hiển thị lỗi
    }

    setShowImportDialog(false);
    setImportClassCodes("");
    setImportErrors([]);
  };

  const handleClearSchedule = () => {
    clearSchedule();
    setShowClearConfirm(false);
    toast.success("Đã xóa lịch đã xếp");
  };

  const handleExportImage = async (action: "download" | "copy") => {
    setForceFullCalendar(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const node = document.getElementById("schedule-calendar");
    if (!node) {
      setForceFullCalendar(false);
      toast.error("Không tìm thấy lịch để xuất ảnh");
      return;
    }

    try {
      toast.loading(action === "download" ? "Đang tạo ảnh..." : "Đang sao chép...", { id: "export-image" });
      await new Promise((resolve) => setTimeout(resolve, 500));

      const dataUrl = await toPng(node, {
        backgroundColor: "#ffffff",
        quality: 1,
        pixelRatio: 2,
        style: {
          overflow: "visible",
        },
      });

      if (action === "download") {
        const link = document.createElement("a");
        link.download = `TKB-UIT-${new Date().toISOString().split("T")[0]}.png`;
        link.href = dataUrl;
        link.click();
        toast.success("Đã tải ảnh thời khóa biểu", { id: "export-image" });
      } else {
        const blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob,
          }),
        ]);
        toast.success("Đã sao chép ảnh vào clipboard", { id: "export-image" });
      }
    } catch (error) {
      console.error("Export error:", error);
      if (action === "copy") {
        toast.error("Lỗi khi sao chép ảnh. Trình duyệt có thể không hỗ trợ.", { id: "export-image" });
      } else {
        toast.error("Lỗi khi xuất ảnh", { id: "export-image" });
      }
    } finally {
      setForceFullCalendar(false);
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <main className="h-screen flex flex-col bg-gray-100">
        {/* Header */}
        <header className="bg-white border-b shadow-sm">
          <div className="px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <div>
                <h1 className="text-lg sm:text-xl font-bold">
                  <span className="text-[#4299e3]">UIT</span>
                  <span className="text-gray-400 mx-1">-</span>
                  <span className="text-[#38b2ac]">ĐKHP</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
              {/* Schedule Manager */}
              {hasData && (
                <div className="flex items-center gap-2 sm:border-r sm:pr-4">
                  <ScheduleManager />
                </div>
              )}

              {/* Special Group Selector */}
              {hasData && (
                <div className="hidden sm:flex items-center gap-2 border-r pr-4">
                  <Select
                    value={filterOptions.specialGroup}
                    onValueChange={(value: "none" | "ANTT" | "TTNT") => setFilterOptions({ specialGroup: value })}
                  >
                    <SelectTrigger className="w-[100px] sm:w-[120px] h-8 sm:h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Nhóm ưu tiên" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Mặc định</SelectItem>
                      <SelectItem value="ANTT">ANTT</SelectItem>
                      <SelectItem value="TTNT">TTNT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Stats badges */}
              {hasData && (
                <div className="hidden md:flex items-center gap-2 sm:gap-4 px-2">
                  <div className="flex flex-col items-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-colors cursor-help",
                            totalCredits < 14 && "bg-amber-50 text-amber-700 border border-amber-200",
                            totalCredits >= 14 &&
                              totalCredits <= 24 &&
                              "bg-green-50 text-green-700 border border-green-200",
                            totalCredits > 24 &&
                              totalCredits <= 30 &&
                              "bg-orange-50 text-orange-700 border border-orange-200",
                            totalCredits > 30 && "bg-red-50 text-red-700 border border-red-200"
                          )}
                        >
                          {totalCredits < 14 ? (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          ) : totalCredits <= 24 ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Info className="h-3.5 w-3.5" />
                          )}
                          <span className="text-xs font-bold">{totalCredits} tín chỉ</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <div className="space-y-1.5 text-xs">
                          <p className="font-bold border-b pb-1 mb-1">Quy định đăng ký tín chỉ:</p>
                          <div className="flex justify-between gap-4">
                            <span>Quy định:</span>
                            <span className="font-semibold text-green-600">14 - 24 TC</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>GPA {">"} 8.0:</span>
                            <span className="font-semibold text-orange-600">25 - 30 TC</span>
                          </div>
                          {totalCredits < 14 && (
                            <p className="text-amber-600 font-medium pt-1 border-t mt-1">
                              Chưa đủ số tín chỉ tối thiểu (14 TC)
                            </p>
                          )}
                          {totalCredits > 24 && totalCredits <= 30 && (
                            <p className="text-orange-600 font-medium pt-1 border-t mt-1">
                              Đăng ký trên 24 TC yêu cầu GPA {">"} 8.0
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <FileUpload />

                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" disabled={!hasSchedule}>
                          <Camera className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{hasSchedule ? "Chụp ảnh TKB" : "Chưa có lịch để chụp"}</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleExportImage("download")} disabled={!hasSchedule}>
                      <Download className="mr-2 h-4 w-4" />
                      <span>Tải xuống</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExportImage("copy")} disabled={!hasSchedule}>
                      <Copy className="mr-2 h-4 w-4" />
                      <span>Sao chép</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" disabled={!hasData}>
                          <FileText className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{hasData ? "Xuất/Nhập mã lớp" : "Chưa có dữ liệu"}</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportCoursesCodes} disabled={!hasSchedule}>
                      <Copy className="mr-2 h-4 w-4" />
                      <span>Xuất mã lớp</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleImportCoursesCodes}>
                      <Download className="mr-2 h-4 w-4" />
                      <span>Nhập mã lớp</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowClearConfirm(true)}
                      disabled={!hasSchedule}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{hasSchedule ? "Xóa lịch đã xếp" : "Chưa có lịch để xóa"}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          <SchedulePlanner forceFullCalendar={forceFullCalendar} />
        </div>

        {/* Clear schedule confirmation dialog */}
        <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Xác nhận xóa lịch
              </DialogTitle>
              <DialogDescription>
                Bạn có chắc muốn xóa toàn bộ lịch đã xếp? Hành động này không thể hoàn tác.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
                Hủy
              </Button>
              <Button variant="destructive" onClick={handleClearSchedule}>
                Xóa lịch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import class codes dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Nhập mã lớp
              </DialogTitle>
              <DialogDescription>Nhập các mã lớp cách nhau bằng dấu phẩy</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <textarea
                className="w-full min-h-[100px] p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
                placeholder="IT001.O11.1,IT002.O12.2,IT003.O13.1,..."
                value={importClassCodes}
                onChange={(e) => {
                  setImportClassCodes(e.target.value);
                  setImportErrors([]);
                }}
              />

              {importErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 max-h-[200px] overflow-y-auto">
                  <h4 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Có {importErrors.length} lỗi:
                  </h4>
                  <ul className="space-y-1">
                    {importErrors.map((error, index) => (
                      <li key={index} className="text-xs text-red-700">
                        • {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportDialog(false);
                  setImportClassCodes("");
                  setImportErrors([]);
                }}
              >
                Hủy
              </Button>
              <Button onClick={handleConfirmImport}>Nhập lịch</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </TooltipProvider>
  );
}
