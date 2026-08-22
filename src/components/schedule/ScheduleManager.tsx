"use client";

/**
 * Component quản lý danh sách nhiều phương án thời khóa biểu (tối đa 5 phương án).
 * Hỗ trợ tạo mới, xóa, chuyển đổi và đổi tên trực tiếp.
 */

import React, { useState, useRef, useEffect } from "react";
import { Plus, Trash2, Calendar, ChevronDown, Pencil } from "lucide-react";

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
  const {
    schedules,
    currentScheduleId,
    addSchedule,
    removeSchedule,
    switchSchedule,
    renameSchedule,
  } = useScheduleStore();

  const MAX_SCHEDULES = 5;
  const [isOpen, setIsOpen] = useState(false);

  // State cho xóa lịch
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // State cho đổi tên inline trực tiếp
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const currentSchedule = schedules.find((s) => s.id === currentScheduleId);
  const canAddMore = schedules.length < MAX_SCHEDULES;

  // Auto focus & select text khi bắt đầu chỉnh sửa inline
  useEffect(() => {
    if (editingId) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [editingId]);

  // Reset editing state khi đóng dropdown
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setEditingId(null);
    }
  };

  const handleAddSchedule = () => {
    if (!canAddMore) {
      toast.error(`Tối đa ${MAX_SCHEDULES} Lịch`);
      return;
    }
    addSchedule();
    toast.success("Đã tạo Lịch mới");
  };

  const handleDelete = (id: string) => {
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

  const handleStartEdit = (schedule: { id: string; name: string }, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(schedule.id);
    setEditingName(schedule.name);
  };

  const handleSaveInlineEdit = (id: string) => {
    if (editingId !== id) return;
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== schedules.find((s) => s.id === id)?.name) {
      renameSchedule(id, trimmed);
    }
    setEditingId(null);
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
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
                className="h-7 w-7 p-0"
                onClick={handleAddSchedule}
                disabled={!canAddMore}
                title="Tạo lịch mới"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Schedule List */}
          <ScrollArea className="max-h-[300px]">
            <div className="p-1 space-y-0.5">
              {schedules.map((schedule) => {
                const isActive = schedule.id === currentScheduleId;
                const isEditing = editingId === schedule.id;
                const canDelete = schedules.length > 1;

                return (
                  <div
                    key={schedule.id}
                    className={cn(
                      "group relative rounded-md transition-colors",
                      isActive ? "bg-primary/10" : "hover:bg-muted/50"
                    )}
                  >
                    {isEditing ? (
                      /* Inline Edit Input */
                      <div
                        className="flex items-center gap-1.5 p-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          ref={inputRef}
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSaveInlineEdit(schedule.id);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingId(null);
                            }
                          }}
                          onBlur={() => handleSaveInlineEdit(schedule.id)}
                          className="h-6 w-full rounded border border-primary bg-background px-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                          maxLength={30}
                        />
                      </div>
                    ) : (
                      /* Schedule Row */
                      <div
                        className="flex items-center gap-1.5 p-1.5 cursor-pointer"
                        onClick={() => handleSwitch(schedule.id)}
                        onDoubleClick={(e) => handleStartEdit(schedule, e)}
                      >
                        {/* Active Indicator */}
                        <div
                          className={cn(
                            "w-1 h-6 rounded-full shrink-0 transition-colors",
                            isActive ? "bg-primary" : "bg-transparent"
                          )}
                        />

                        {/* Schedule Info */}
                        <div className="flex-1 min-w-0">
                          <span
                            className={cn(
                              "font-medium text-xs truncate block",
                              isActive ? "text-primary font-semibold" : "text-foreground"
                            )}
                            title={schedule.name}
                          >
                            {schedule.name}
                          </span>
                        </div>

                        {/* Credits Badge */}
                        <Badge
                          variant="secondary"
                          className="h-4 px-1 text-[9px] shrink-0 font-normal group-hover:hidden"
                        >
                          {schedule.totalCredits} TC
                        </Badge>

                        {/* Action Buttons (Hiện khi hover thay cho badge) */}
                        <div className="hidden group-hover:flex items-center shrink-0">
                          {/* Rename Button */}
                          <button
                            type="button"
                            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Đổi tên"
                            onClick={(e) => handleStartEdit(schedule, e)}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>

                          {/* Delete Button */}
                          {canDelete && (
                            <button
                              type="button"
                              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                              title="Xóa"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(schedule.id);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
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
