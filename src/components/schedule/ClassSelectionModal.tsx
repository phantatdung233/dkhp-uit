"use client";

/**
 * Modal hiển thị danh sách các lớp học phần cùng khung giờ để người dùng chọn hoặc thay thế lớp trùng.
 */

import React, { useState, useEffect } from "react";
import { Clock, User, MapPin, Calendar, Users, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useScheduleStore } from "@/store/schedule-store";
import { getConflictingScheduledClasses } from "@/store/schedule-store-helpers";
import type { ClassSection } from "@/types";
import { DAY_NAMES } from "@/types";
import { cn } from "@/lib/utils";
import { ProfessorRatingBadge, ProfessorReviewModal } from "./ProfessorReviewModal";

export function ClassSelectionModal() {
  const {
    isClassSelectionModalOpen,
    classSelectionOptions,
    pendingSlot,
    closeClassSelectionModal,
    selectClassFromModal,
  } = useScheduleStore();

  const [reviewModalLecturer, setReviewModalLecturer] = useState<string | null>(null);

  const [displayData, setDisplayData] = useState<{
    options: ClassSection[];
    slot: { dayOfWeek: number; period: number } | null;
  }>({ options: [], slot: null });

  useEffect(() => {
    if (isClassSelectionModalOpen && pendingSlot) {
      setDisplayData({ options: classSelectionOptions, slot: pendingSlot });
    }
  }, [isClassSelectionModalOpen, classSelectionOptions, pendingSlot]);

  if (!displayData.slot) return null;

  return (
    <>
      <Dialog open={isClassSelectionModalOpen} onOpenChange={closeClassSelectionModal}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Chọn lớp học phần
            </DialogTitle>
            <DialogDescription>
              Có {displayData.options.length} lựa chọn vào <strong>{DAY_NAMES[displayData.slot.dayOfWeek]}</strong>, tiết{" "}
              <strong>{displayData.slot.period}</strong>:
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3 pr-4">
              {displayData.options.map((section) => (
                <ClassOption 
                  key={section.id} 
                  section={section} 
                  onSelect={() => selectClassFromModal(section)} 
                  onOpenReview={(lecturer) => setReviewModalLecturer(lecturer)}
                />
              ))}
            </div>
          </ScrollArea>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={closeClassSelectionModal}>
              Hủy
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProfessorReviewModal
        professorName={reviewModalLecturer}
        open={Boolean(reviewModalLecturer)}
        onOpenChange={(open) => !open && setReviewModalLecturer(null)}
      />
    </>
  );
}

interface ClassOptionProps {
  section: ClassSection;
  onSelect: () => void;
  onOpenReview?: (lecturer: string) => void;
}

function ClassOption({ section, onSelect, onOpenReview }: ClassOptionProps) {
  const { scheduledClasses, replaceClassWithSection, closeClassSelectionModal } = useScheduleStore();
  const conflictingClasses = getConflictingScheduledClasses(section, scheduledClasses);
  const hasConflict = conflictingClasses.length > 0;

  const handleCardClick = () => {
    if (hasConflict) {
      closeClassSelectionModal();
      const result = replaceClassWithSection(section);
      if (result.success) {
        const removedNames = result.removedClasses?.map((c) => c.courseName).join(", ");
        toast.success(
          removedNames
            ? `Đã thay thế "${removedNames}" bằng "${section.courseName}"`
            : `Đã thay thế bằng "${section.courseName}"`
        );
      }
    } else {
      onSelect();
    }
  };

  return (
    <div
      className={cn(
        "p-3.5 rounded-lg border-2 transition-all cursor-pointer",
        hasConflict
          ? "border-amber-200 bg-amber-50/40 hover:border-amber-400 hover:bg-amber-50/70"
          : "border-gray-200 hover:border-primary hover:bg-primary/5"
      )}
      onClick={handleCardClick}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-semibold text-base text-gray-900">{section.courseName}</h4>
          <p className="text-sm text-gray-500">{section.classCode}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {hasConflict && (
            <Badge variant="destructive" className="text-[10px]">
              Trùng {conflictingClasses.length} lớp
            </Badge>
          )}
          <Badge variant={section.isPractical ? "secondary" : "outline"}>
            {section.isPractical ? "Thực hành" : "Lý thuyết"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-1.5 text-gray-700 col-span-2 sm:col-span-1">
          <User className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="truncate font-medium">{section.lecturer}</span>
          <ProfessorRatingBadge
            lecturerName={section.lecturer}
            size="sm"
            onClick={() => onOpenReview?.(section.lecturer)}
          />
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="h-4 w-4 text-gray-400 shrink-0" />
          <span>Tiết {section.periods}</span>
        </div>
        {section.room && (
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin className="h-4 w-4 text-gray-400" />
            <span>{section.room}</span>
          </div>
        )}
        {section.maxStudents && (
          <div className="flex items-center gap-2 text-gray-600">
            <Users className="h-4 w-4 text-gray-400" />
            <span>Sĩ số: {section.maxStudents}</span>
          </div>
        )}
      </div>

      {(section.startDate || section.endDate) && (
        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
          <Calendar className="h-3 w-3" />
          {section.startDate && <span>{format(section.startDate, "dd/MM/yyyy", { locale: vi })}</span>}
          {section.startDate && section.endDate && <span>→</span>}
          {section.endDate && <span>{format(section.endDate, "dd/MM/yyyy", { locale: vi })}</span>}
        </div>
      )}

      {(section.faculty || section.cohort) && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {section.faculty && (
            <Badge variant="outline" className="text-[10px] bg-blue-50/50 text-blue-700 border-blue-200">
              Khoa {section.faculty}
            </Badge>
          )}
          {section.cohort && (
            <Badge variant="outline" className="text-[10px] bg-purple-50/50 text-purple-700 border-purple-200">
              Khoá {section.cohort}
            </Badge>
          )}
        </div>
      )}

      <div className="mt-3">
        {hasConflict ? (
          <Button size="sm" className="w-full bg-red-600 hover:bg-red-700 text-white gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Thay thế lớp bị trùng
          </Button>
        ) : (
          <Button size="sm" className="w-full">
            Chọn lớp này
          </Button>
        )}
      </div>
    </div>
  );
}

export default ClassSelectionModal;
