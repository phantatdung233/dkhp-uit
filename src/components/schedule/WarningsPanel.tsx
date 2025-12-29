"use client";

/**
 * WarningsPanel Component
 * =======================
 * Hiển thị các cảnh báo về thiếu lớp thực hành/lý thuyết
 */

import React from "react";
import { AlertTriangle, X, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useScheduleStore } from "@/store/schedule-store";
import { cn } from "@/lib/utils";

export function WarningsPanel() {
  const { warnings, dismissWarning } = useScheduleStore();

  if (warnings.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm space-y-2">
      {warnings.map((warning) => (
        <div
          key={warning.id}
          className={cn(
            "p-4 rounded-lg shadow-lg border-l-4 bg-white",
            warning.type === "missing_practical" && "border-l-orange-500",
            warning.type === "missing_theory" && "border-l-blue-500",
            warning.type === "time_overlap" && "border-l-red-500"
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={cn(
                "h-5 w-5 mt-0.5",
                warning.type === "missing_practical" && "text-orange-500",
                warning.type === "missing_theory" && "text-blue-500",
                warning.type === "time_overlap" && "text-red-500"
              )}
            />

            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {warning.type === "missing_practical" && "Cần đăng ký lớp Thực hành"}
                {warning.type === "missing_theory" && "Cần đăng ký lớp Lý thuyết"}
                {warning.type === "time_overlap" && "Trùng lịch học"}
              </p>
              <p className="text-sm text-gray-600 mt-1">{warning.message}</p>
            </div>

            <button onClick={() => dismissWarning(warning.id)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default WarningsPanel;
