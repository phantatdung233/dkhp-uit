"use client";

/**
 * ScheduleManager Component
 * =========================
 * Component quản lý nhiều Lịch thời khóa biểu
 * Hỗ trợ: Tạo mới (tối đa 5), xóa, đổi tên, chuyển đổi giữa các Lịch
 */

import React, { useState } from "react";
import { Plus, Trash2, Calendar, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useScheduleStore } from "@/store/schedule-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ScheduleManager() {
  const { schedules, currentScheduleId, addSchedule, removeSchedule, switchSchedule } = useScheduleStore();

  const MAX_SCHEDULES = 5;
  const [isOpen, setIsOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const currentSchedule = schedules.find((s) => s.id === currentScheduleId);
  const canAddMore = schedules.length < MAX_SCHEDULES;

  const handleAddSchedule = () => {
    if (!canAddMore) {
      toast.error(`Tối đa ${MAX_SCHEDULES} Lịch`);
      return;
    }
    addSchedule();
    toast.success("Đã tạo Lịch mới");
  };

  const handleDelete = (id: string) => {
    const scheduleToDelete = schedules.find((s) => s.id === id);

    // Không cho xóa Lịch 1 (default)
    if (scheduleToDelete?.name === "Lịch 1") {
      toast.error("Không thể xóa Lịch 1");
      return;
    }

    if (schedules.length <= 1) {
      toast.error("Phải có ít nhất 1 Lịch");
      return;
    }
    removeSchedule(id);
    setDeleteConfirmId(null);
    toast.success("Đã xóa Lịch");
  };

  const handleSwitch = (id: string) => {
    if (id !== currentScheduleId) {
      switchSchedule(id);
      setIsOpen(false);
    }
  };

  // Tính số môn đã đăng ký cho mỗi schedule
  const getRegisteredCourseCount = (scheduledClasses: (typeof schedules)[0]["scheduledClasses"]) => {
    const courseSet = new Set(scheduledClasses.map((sc) => sc.classSection.courseCode));
    return courseSet.size;
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-8 sm:h-9 gap-1.5 sm:gap-2 min-w-0 sm:min-w-[185px] justify-between px-2 sm:px-4"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
              <span className="font-medium truncate text-xs sm:text-sm max-w-[70px] sm:max-w-[120px]">
                {currentSchedule?.name || "Chọn Lịch"}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Badge variant="secondary" className="h-5 px-1 sm:px-1.5 text-[9px] sm:text-[10px] whitespace-nowrap">
                {currentSchedule?.totalCredits || 0} TC
              </Badge>
              <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-50" />
            </div>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[185px] p-0">
          {/* Header */}
          <div className="px-3 py-2 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">
                Lịch ({schedules.length}/{MAX_SCHEDULES})
              </h4>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5"
                onClick={handleAddSchedule}
                disabled={!canAddMore}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Schedule List */}
          <ScrollArea className="max-h-[300px]">
            <div className="p-1">
              {schedules.map((schedule) => {
                const isActive = schedule.id === currentScheduleId;
                const courseCount = getRegisteredCourseCount(schedule.scheduledClasses);
                const isDefaultSchedule = schedule.name === "Lịch 1";
                const canDelete = !isDefaultSchedule && schedules.length > 1;

                return (
                  <div
                    key={schedule.id}
                    className={cn(
                      "group relative rounded-md transition-colors",
                      isActive ? "bg-primary/10" : "hover:bg-muted/50"
                    )}
                  >
                    <div
                      className="flex items-center gap-2 p-2 cursor-pointer"
                      onClick={() => handleSwitch(schedule.id)}
                    >
                      {/* Active Indicator */}
                      <div
                        className={cn(
                          "w-1.5 h-8 rounded-full shrink-0 transition-colors",
                          isActive ? "bg-primary" : "bg-transparent"
                        )}
                      />

                      {/* Schedule Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "font-medium text-sm truncate",
                              isActive ? "text-primary" : "text-foreground"
                            )}
                          >
                            {schedule.name}
                          </span>
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] shrink-0">
                            {schedule.totalCredits} TC
                          </Badge>
                        </div>
                      </div>

                      {/* Delete Button */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                          "h-7 w-7 transition-opacity",
                          canDelete
                            ? "opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700 hover:bg-red-50"
                            : "opacity-30 cursor-not-allowed"
                        )}
                        disabled={!canDelete}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canDelete) {
                            setDeleteConfirmId(schedule.id);
                            setIsDeleteDialogOpen(true);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Footer hint */}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Xác nhận xóa
            </DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa Lịch "<strong>{schedules.find((s) => s.id === deleteConfirmId)?.name}</strong>"? Hành
              động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirmId) {
                  handleDelete(deleteConfirmId);
                  setIsDeleteDialogOpen(false);
                }
              }}
            >
              Xóa Lịch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ScheduleManager;
