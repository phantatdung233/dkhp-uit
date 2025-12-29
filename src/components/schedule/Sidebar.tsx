"use client";

/**
 * Sidebar Component
 * =================
 * Hiển thị danh sách môn học
 * Hỗ trợ tìm kiếm và click để chọn môn đặt vào lịch
 */

import React from "react";
import { Search, X, BookOpen } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useScheduleStore, useFilteredCourses } from "@/store/schedule-store";
import type { Course } from "@/types";
import { COURSE_COLORS } from "@/types";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const { filterOptions, setFilterOptions } = useScheduleStore();
  const filteredCourses = useFilteredCourses();

  return (
    <aside className="w-80 max-w-[85vw] border-r bg-white flex flex-col h-full shadow-xl lg:shadow-none">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b bg-white flex justify-between items-center">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[#2f6bff] flex items-center gap-2">Danh sách môn học</h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="p-3 sm:p-4 border-b bg-white">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Tìm môn, giảng viên, mã lớp..."
            value={filterOptions.searchQuery}
            onChange={(e) => setFilterOptions({ searchQuery: e.target.value })}
            className="pl-9 text-sm"
          />
          {filterOptions.searchQuery && (
            <button
              onClick={() => setFilterOptions({ searchQuery: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Course list */}
      <ScrollArea className="flex-1 p-3 sm:p-4">
        <div className="space-y-2">
          {filteredCourses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Không tìm thấy môn học nào</p>
            </div>
          ) : (
            filteredCourses.map((course, index) => (
              <CourseItem key={course.id} course={course} colorIndex={index % COURSE_COLORS.length} onSelect={onClose} />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 sm:p-4 border-t bg-white text-center">
        <p className="text-xs text-gray-500">Hiển thị {filteredCourses.length} môn học</p>
      </div>
    </aside>
  );
}

// ============ Course Item ============

interface CourseItemProps {
  course: Course;
  colorIndex: number;
  onSelect?: () => void;
}

function CourseItem({ course, colorIndex, onSelect }: CourseItemProps) {
  const {
    scheduledClasses,
    clickSelectedCourse,
    clickSelectedType,
    setClickSelectedCourse,
    setClickSelectedLecturer,
    pendingTheorySection,
    clearClickSelection,
    updateHighlightedSlots,
  } = useScheduleStore();

  // Check if course is registered
  const isRegistered = scheduledClasses.some((sc) => sc.classSection.courseCode === course.courseCode);

  // Get registered sections count
  const registeredSectionsCount = scheduledClasses.filter(
    (sc) => sc.classSection.courseCode === course.courseCode
  ).length;

  // Check if this course is click-selected
  const isClickSelected = clickSelectedCourse?.id === course.id;

  // Handle click - select course for placement
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isClickSelected) {
      clearClickSelection();
    } else {
      setClickSelectedCourse(course);
      setClickSelectedLecturer(null);
      // Tự động đóng sidebar trên mobile sau khi chọn môn
      if (onSelect) onSelect();
    }
  };

  const colorClass = COURSE_COLORS[colorIndex];

  return (
    <div className="relative">
      <div
        onClick={handleClick}
        className={cn(
          "p-3 rounded-lg border-2 cursor-pointer transition-all",
          colorClass,
          isClickSelected && "ring-2 ring-blue-500 ring-offset-2 shadow-lg",
          isRegistered && "border-dashed opacity-70"
        )}
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm break-words">{course.courseName}</h3>
              {pendingTheorySection && pendingTheorySection.courseCode === course.courseCode && (
                <Badge variant="warning" className="text-[10px] px-1 h-4 animate-pulse">
                  Chọn TH
                </Badge>
              )}
            </div>
            <p className="text-xs opacity-70 mt-0.5">{course.courseCode}</p>
          </div>
          <Badge variant={isRegistered ? "success" : "secondary"} className="shrink-0 pointer-events-none">
            {course.credits} TC
          </Badge>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {course.hasTheoryClass && (
            <Badge variant="info" className="text-xs pointer-events-none">
              Lý thuyết
            </Badge>
          )}
          {course.hasPracticalClass && (
            <Badge variant="warning" className="text-xs pointer-events-none">
              Thực hành
            </Badge>
          )}
          {isRegistered && (
            <Badge variant="success" className="text-xs pointer-events-none">
              Đã ĐK ({registeredSectionsCount})
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
