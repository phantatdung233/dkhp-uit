"use client";

/**
 * ClassSelectionModal Component
 * =============================
 * Modal hiển thị khi có nhiều lớp cùng giờ để user chọn hoặc thay thế
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

export function ClassSelectionModal() {
  const {
    isClassSelectionModalOpen,
    classSelectionOptions,
    pendingSlot,
    closeClassSelectionModal,
    selectClassFromModal,
  } = useScheduleStore();

  // Buffer data to avoid flicker during close animation
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
    <Dialog open={isClassSelectionModalOpen} onOpenChange={closeClassSelectionModal}>
      <DialogContent className="sm:max-w-lg">
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
              <ClassOption key={section.id} section={section} onSelect={() => selectClassFromModal(section)} />
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
  );
}

// ============ Class Option Card ============

interface ClassOptionProps {
  section: ClassSection;
  onSelect: () => void;
}

function ClassOption({ section, onSelect }: ClassOptionProps) {
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
        "p-4 rounded-lg border-2 cursor-pointer transition-all",
        hasConflict
          ? "border-red-300 bg-red-50/50 hover:border-red-500 hover:bg-red-100/60"
          : section.isPractical
          ? "border-orange-200 bg-orange-50/50 hover:border-primary hover:bg-primary/5"
          : "border-blue-200 bg-blue-50/50 hover:border-primary hover:bg-primary/5"
      )}
      onClick={handleCardClick}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-semibold text-gray-900">{section.courseName}</h4>
          <p className="text-sm text-gray-500">{section.classCode}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {hasConflict && (
            <Badge variant="destructive" className="text-[10px]">
              Trùng {conflictingClasses.length} lớp
            </Badge>
          )}
          <Badge variant={section.isPractical ? "warning" : "info"}>
            {section.isPractical ? "Thực hành" : "Lý thuyết"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <User className="h-4 w-4 text-gray-400" />
          <span className="truncate">{section.lecturer}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Clock className="h-4 w-4 text-gray-400" />
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
