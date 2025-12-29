"use client";

import React, { useMemo, useState } from "react";
import { Upload, Trash2, AlertTriangle, CheckCircle2, Camera, Copy, Info, Download, FileText } from "lucide-react";

import { SchedulePlanner, FileUpload, ScheduleManager } from "@/components/schedule";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  } = useScheduleStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const hasData = allSections.length > 0;
  const hasSchedule = scheduledClasses.length > 0;

  // Tính số môn đã đăng ký
  const registeredCourseCount = useMemo(() => {
    const courseSet = new Set(scheduledClasses.map((sc) => sc.classSection.courseCode));
    return courseSet.size;
  }, [scheduledClasses]);

  // Copy all course codes
  const handleCopyCoursesCodes = () => {
    const classCodes = scheduledClasses
      .map((sc) => sc.classSection.classCode)
      .sort()
      .join(",");

    if (!classCodes) {
      toast.error("Chưa có lớp nào để sao chép");
      return;
    }

    navigator.clipboard.writeText(classCodes);
    toast.success(`Đã sao chép ${scheduledClasses.length} mã lớp`);
  };

  // Handle clear schedule with confirmation
  const handleClearSchedule = () => {
    clearSchedule();
    setShowClearConfirm(false);
    toast.success("Đã xóa lịch đã xếp");
  };

  // Export schedule to Image
  const handleExportImage = async (action: "download" | "copy") => {
    // Check minimum credits requirement
    if (totalCredits < 14) {
      toast.error("Cần đăng ký tối thiểu 14 tín chỉ để chụp ảnh thời khóa biểu");
      return;
    }

    const node = document.getElementById("schedule-calendar");
    if (!node) {
      toast.error("Không tìm thấy lịch để xuất ảnh");
      return;
    }

    try {
      toast.loading(action === "download" ? "Đang tạo ảnh..." : "Đang sao chép...", { id: "export-image" });

      // Đợi một chút để đảm bảo UI ổn định
      await new Promise((resolve) => setTimeout(resolve, 500));

      const dataUrl = await toPng(node, {
        backgroundColor: "#ffffff",
        quality: 1,
        pixelRatio: 2, // Tăng độ phân giải
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
        // Copy to clipboard
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
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <main className="h-screen flex flex-col bg-gray-100">
        {/* Header */}
        <header className="bg-white border-b shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-bold">
                  <span className="text-[#4299e3]">UIT</span>
                  <span className="text-gray-400 mx-1">-</span>
                  <span className="text-[#38b2ac]">ĐKHP</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Schedule Manager */}
              {hasData && (
                <div className="flex items-center gap-2 border-r pr-4">
                  <ScheduleManager />
                </div>
              )}

              {/* Special Group Selector */}
              {hasData && (
                <div className="flex items-center gap-2 border-r pr-4">
                  <Select
                    value={filterOptions.specialGroup}
                    onValueChange={(value: "none" | "ANTT" | "TTNT") => setFilterOptions({ specialGroup: value })}
                  >
                    <SelectTrigger className="w-[120px] h-9">
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
                <div className="hidden lg:flex items-center gap-4 px-2">
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

                {hasSchedule && (
                  <>
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              disabled={totalCredits < 14}
                              className={cn(totalCredits < 14 && "opacity-50 cursor-not-allowed")}
                            >
                              <Camera className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>
                          {totalCredits < 14 ? "Cần tối thiểu 14 tín chỉ để chụp ảnh" : "Chụp ảnh thời khóa biểu"}
                        </TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExportImage("download")}>
                          <Download className="mr-2 h-4 w-4" />
                          <span>Tải xuống</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportImage("copy")}>
                          <Copy className="mr-2 h-4 w-4" />
                          <span>Sao chép</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={handleCopyCoursesCodes}>
                          <FileText className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Sao chép mã lớp</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" onClick={() => setShowClearConfirm(true)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Xóa lịch đã xếp</TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          <SchedulePlanner />
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
      </main>
    </TooltipProvider>
  );
}
