"use client";

/**
 * SchedulePlanner Component
 * =========================
 * Component chính tổ chức layout
 */

import React, { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

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
        {/* Mobile sidebar toggle button */}
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 left-4 z-50 lg:hidden shadow-lg bg-white"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {/* Mobile overlay */}
        {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={handleOverlayClick} />}

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
        <div className="flex-1 flex flex-col overflow-hidden">
          <CalendarGrid showFullWeek={forceFullCalendar} />
        </div>
      </div>

      {/* Class selection modal */}
      <ClassSelectionModal />
    </TooltipProvider>
  );
}

export default SchedulePlanner;
