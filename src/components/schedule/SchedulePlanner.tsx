"use client";

/**
 * Component chính điều phối giao diện phân hệ xếp thời khóa biểu (Sidebar danh sách môn + Lưới TKB).
 */

import React, { useEffect, useState } from "react";
import { Menu } from "lucide-react";

import { Sidebar } from "./Sidebar";
import { CalendarGrid } from "./CalendarGrid";
import { ClassSelectionModal } from "./ClassSelectionModal";

import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useScheduleStore } from "@/store/schedule-store";
import { cn } from "@/lib/utils";

interface SchedulePlannerProps {
  forceFullCalendar?: boolean;
}

export function SchedulePlanner({ forceFullCalendar = false }: SchedulePlannerProps) {
  const { pendingTheorySection, updateHighlightedSlots } = useScheduleStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (pendingTheorySection) {
      useScheduleStore.setState({ clickSelectedType: "practical" });
      updateHighlightedSlots();
    }
  }, [pendingTheorySection, updateHighlightedSlots]);

  const handleOverlayClick = () => {
    setIsSidebarOpen(false);
  };

  return (
    <TooltipProvider>
      <div className="flex h-full relative">
        {/* Mobile & Tablet floating sidebar toggle button */}
        {!isSidebarOpen && (
          <Button
            variant="default"
            size="default"
            className="fixed bottom-5 left-4 z-50 lg:hidden shadow-xl rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 transition-transform active:scale-95 border border-white/20"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Mở danh sách môn học"
          >
            <Menu className="h-5 w-5 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">Danh sách môn</span>
          </Button>
        )}

        {/* Mobile overlay with backdrop blur */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 lg:hidden transition-opacity"
            onClick={handleOverlayClick}
          />
        )}

        {/* Sidebar with course list */}
        <div
          className={cn(
            "fixed lg:relative z-40 h-full transition-transform duration-300 ease-in-out",
            "lg:translate-x-0",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar onClose={() => setIsSidebarOpen(false)} />
        </div>

        {/* Main calendar area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <CalendarGrid showFullWeek={forceFullCalendar} />
        </div>
      </div>

      {/* Class selection modal */}
      <ClassSelectionModal />
    </TooltipProvider>
  );
}

export default SchedulePlanner;
