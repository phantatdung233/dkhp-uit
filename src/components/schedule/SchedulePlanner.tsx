"use client";

/**
 * SchedulePlanner Component
 * =========================
 * Component chính tổ chức layout
 */

import React, { useEffect } from "react";

import { Sidebar } from "./Sidebar";
import { CalendarGrid } from "./CalendarGrid";
import { ClassSelectionModal } from "./ClassSelectionModal";
import { WarningsPanel } from "./WarningsPanel";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useScheduleStore } from "@/store/schedule-store";

export function SchedulePlanner() {
  const { pendingTheorySection, updateHighlightedSlots } = useScheduleStore();

  // Khi component mount, nếu có pendingTheorySection (từ persist state sau reload)
  // thì tự động highlight các lớp TH tương ứng
  useEffect(() => {
    if (pendingTheorySection) {
      useScheduleStore.setState({ clickSelectedType: "practical" });
      updateHighlightedSlots();
    }
  }, [pendingTheorySection, updateHighlightedSlots]);

  return (
    <TooltipProvider>
      <div className="flex h-full">
        {/* Sidebar with course list */}
        <Sidebar />

        {/* Main calendar area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <CalendarGrid />
        </div>
      </div>

      {/* Class selection modal */}
      <ClassSelectionModal />

      {/* Warnings panel */}
      <WarningsPanel />
    </TooltipProvider>
  );
}

export default SchedulePlanner;
