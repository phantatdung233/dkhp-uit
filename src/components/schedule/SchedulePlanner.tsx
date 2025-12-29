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
import { WarningsPanel } from "./WarningsPanel";

import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useScheduleStore } from "@/store/schedule-store";
import { cn } from "@/lib/utils";

export function SchedulePlanner() {
  const { pendingTheorySection, updateHighlightedSlots } = useScheduleStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Khi component mount, nếu có pendingTheorySection (từ persist state sau reload)
  // thì tự động highlight các lớp TH tương ứng
  useEffect(() => {
    if (pendingTheorySection) {
      useScheduleStore.setState({ clickSelectedType: "practical" });
      updateHighlightedSlots();
    }
  }, [pendingTheorySection, updateHighlightedSlots]);

  // Close sidebar when clicking outside on mobile
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
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
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
