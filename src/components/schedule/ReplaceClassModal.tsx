"use client";

/**
 * Modal xác nhận thay thế lớp học phần khi có xung đột thời gian hoặc trùng loại môn học.
 */

import React from "react";
import { AlertTriangle, RefreshCw, User, Clock, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProfessorRatingBadge } from "./ProfessorReviewModal";

import { useScheduleStore } from "@/store/schedule-store";
import { DAY_NAMES } from "@/types";

export function ReplaceClassModal() {
  const { isReplaceModalOpen, replaceModalData, closeReplaceModal, confirmReplace } = useScheduleStore();

  if (!replaceModalData) return null;

  const { newSection, conflictingClasses } = replaceModalData;

  const handleConfirm = () => {
    confirmReplace();
    toast.success(`Đã thay thế thành công lớp "${newSection.courseName}" vào lịch`);
  };

  return (
    <Dialog open={isReplaceModalOpen} onOpenChange={closeReplaceModal}>
      <DialogContent className="w-[95vw] sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 text-lg">
            <RefreshCw className="h-5 w-5 animate-spin-reverse" />
            Thay thế lớp học bị trùng
          </DialogTitle>
          <DialogDescription>
            Lớp học bạn chọn bị trùng lịch với lớp đã có. Xác nhận thay thế để gỡ bỏ lớp cũ và xếp lớp mới vào lịch.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh] pr-2">
          <div className="space-y-4 py-2">
            {/* Lớp mới muốn thêm */}
            <div className="rounded-lg border-2 border-green-300 bg-green-50/70 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-green-800 text-xs uppercase tracking-wide">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-white text-[10px]">
                    +
                  </span>
                  Lớp mới muốn thêm
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={newSection.isPractical ? "warning" : "info"} className="text-[10px]">
                    {newSection.isPractical ? "Thực hành" : "Lý thuyết"}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {newSection.credits} TC
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 text-sm">{newSection.courseName}</h4>
                <p className="text-xs text-gray-600 font-medium">{newSection.classCode}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 pt-1 border-t border-green-200">
                <div className="flex items-center gap-1.5 min-w-0">
                  <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="truncate font-medium">{newSection.lecturer}</span>
                  <ProfessorRatingBadge lecturerName={newSection.lecturer} size="sm" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  <span className="font-medium">
                    {newSection.dayOfWeek ? DAY_NAMES[newSection.dayOfWeek] : "Linh hoạt"} - Tiết {newSection.periods}
                  </span>
                </div>
                {newSection.room && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span>Phòng: {newSection.room}</span>
                  </div>
                )}
                {(newSection.startDate || newSection.endDate) && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span>
                      {newSection.startDate ? format(newSection.startDate, "dd/MM") : "?"} -{" "}
                      {newSection.endDate ? format(newSection.endDate, "dd/MM") : "?"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Mũi tên chuyển đổi */}
            <div className="flex items-center justify-center -my-1">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full border border-amber-300 shadow-sm">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                Sẽ thay thế {conflictingClasses.length} lớp bị trùng
              </div>
            </div>

            {/* Danh sách lớp bị trùng sẽ bị xóa */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide">
                Các lớp bị trùng sẽ bị gỡ khỏi lịch:
              </p>
              {conflictingClasses.map((sc) => {
                const section = sc.classSection;
                return (
                  <div
                    key={sc.id}
                    className="rounded-lg border-2 border-red-300 bg-red-50/70 p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-red-800 text-xs">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white text-[10px]">
                          -
                        </span>
                        <span className="truncate">{section.courseName}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant={section.isPractical ? "warning" : "info"} className="text-[9px] h-4">
                          {section.isPractical ? "TH" : "LT"}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] h-4">
                          {section.credits} TC
                        </Badge>
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 font-medium">{section.classCode}</div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-700 pt-1 border-t border-red-200">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{section.lecturer}</span>
                        <ProfessorRatingBadge lecturerName={section.lecturer} size="sm" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span>
                          {section.dayOfWeek ? DAY_NAMES[section.dayOfWeek] : "Linh hoạt"} - Tiết {section.periods}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 pt-3 border-t">
          <Button variant="outline" onClick={closeReplaceModal}>
            Hủy
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5 shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Xác nhận thay thế
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReplaceClassModal;
