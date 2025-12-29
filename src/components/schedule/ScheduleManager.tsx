"use client";

/**
 * ScheduleManager Component
 * =========================
 * Component quản lý nhiều TKB thời khóa biểu
 * Hỗ trợ: Tạo mới (tối đa 5), xóa, đổi tên, chuyển đổi giữa các TKB
 */

import React, { useState } from "react";
import { Plus, Trash2, Edit2, Check, X, Calendar, ChevronDown, MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { ScrollArea } from "@/components/ui/scroll-area";

import { useScheduleStore } from "@/store/schedule-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function ScheduleManager() {
  const { schedules, currentScheduleId, addSchedule, removeSchedule, switchSchedule, renameSchedule } =
    useScheduleStore();

  const MAX_SCHEDULES = 5;
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const currentSchedule = schedules.find((s) => s.id === currentScheduleId);
  const canAddMore = schedules.length < MAX_SCHEDULES;

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleSaveEdit = () => {
    if (editingId && editingName.trim()) {
      renameSchedule(editingId, editingName.trim());
      toast.success("Đã đổi tên TKB");
    }
    setEditingId(null);
    setEditingName("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleAddSchedule = () => {
    if (!canAddMore) {
      toast.error(`Tối đa ${MAX_SCHEDULES} TKB`);
      return;
    }
    addSchedule();
    toast.success("Đã tạo TKB mới");
  };

  const handleDelete = (id: string) => {
    if (schedules.length <= 1) {
      toast.error("Phải có ít nhất 1 TKB");
      return;
    }
    removeSchedule(id);
    setDeleteConfirmId(null);
    toast.success("Đã xóa TKB");
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
          <Button variant="outline" className="h-9 gap-2 min-w-[200px] justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-medium truncate max-w-[120px]">{currentSchedule?.name || "Chọn TKB"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {currentSchedule?.totalCredits || 0} TC
              </Badge>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[200px] p-0">
          {/* Header */}
          <div className="px-3 py-2 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">
                TKB ({schedules.length}/{MAX_SCHEDULES})
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
                const isEditing = editingId === schedule.id;
                const courseCount = getRegisteredCourseCount(schedule.scheduledClasses);

                return (
                  <div
                    key={schedule.id}
                    className={cn(
                      "group relative rounded-md transition-colors",
                      isActive ? "bg-primary/10" : "hover:bg-muted/50"
                    )}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 p-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit();
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleSaveEdit}>
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleCancelEdit}>
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ) : (
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

                        {/* Actions */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(schedule.id, schedule.name);
                              }}
                            >
                              <Edit2 className="h-4 w-4 mr-2" />
                              Đổi tên
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              disabled={schedules.length <= 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(schedule.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Xóa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Footer hint */}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Xác nhận xóa
            </DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa TKB "<strong>{schedules.find((s) => s.id === deleteConfirmId)?.name}</strong>"? Hành
              động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
              Xóa TKB
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ScheduleManager;
