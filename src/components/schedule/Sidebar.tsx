"use client";

/**
 * Component thanh bên (Sidebar) hiển thị danh sách môn học.
 * Hỗ trợ tìm kiếm nhanh, lọc theo khóa học, khoa quản lý, loại lớp và click chọn môn để xếp vào lịch.
 */

import React, { useMemo } from "react";
import { Search, X, BookOpen, GraduationCap, Building2, RotateCcw, AlertTriangle, Upload } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useScheduleStore, useFilteredCourses } from "@/store/schedule-store";
import type { Course } from "@/types";
import { COURSE_COLORS } from "@/types";
import { cn } from "@/lib/utils";

const DEFAULT_FACULTIES = [
  "KHMT",
  "CNPM",
  "HTTT",
  "KTMT",
  "MMT&TT",
  "KTTT",
  "TTNN",
  "PĐTĐH",
  "BMTL",
];

const DEFAULT_COHORTS = ["21", "20", "19", "18", "17", "All"];

function formatCohortLabel(cohort: string): string {
  if (cohort === "all") return "Tất cả khoá";
  if (cohort === "0") return "Chung (0)";
  if (cohort.toLowerCase() === "all") return "Tất cả khoá (All)";
  const num = parseInt(cohort, 10);
  if (!isNaN(num)) {
    if (num < 100) return `Khoá ${cohort}`;
    return `Khoá ${cohort}`;
  }
  return `Khoá ${cohort}`;
}

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const { filterOptions, setFilterOptions, allSections, resetFilters } = useScheduleStore();
  const filteredCourses = useFilteredCourses();

  // Kiểm tra xem dữ liệu hiện tại trong memory đã có thông tin khoá học chưa
  const hasCohortData = useMemo(() => {
    return allSections.some((s) => Boolean(s.cohort && s.cohort.trim()));
  }, [allSections]);

  // Extract distinct cohorts from all sections, or use default UIT cohorts
  const cohortOptions = useMemo(() => {
    const set = new Set<string>();
    allSections.forEach((s) => {
      if (s.cohort && s.cohort.trim()) {
        set.add(s.cohort.trim());
      }
    });
    if (set.size === 0) {
      DEFAULT_COHORTS.forEach((c) => set.add(c));
    }
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numB - numA; // Newest / largest first
      }
      return a.localeCompare(b);
    });
  }, [allSections]);

  // Extract distinct faculties from all sections, or use default UIT faculties
  const facultyOptions = useMemo(() => {
    const set = new Set<string>();
    allSections.forEach((s) => {
      if (s.faculty && s.faculty.trim()) {
        set.add(s.faculty.trim());
      }
    });
    if (set.size === 0) {
      DEFAULT_FACULTIES.forEach((f) => set.add(f));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allSections]);

  const hasActiveFilters = Boolean(
    filterOptions.searchQuery ||
    (filterOptions.cohortFilter && filterOptions.cohortFilter !== "all") ||
    (filterOptions.facultyFilter && filterOptions.facultyFilter !== "all")
  );

  return (
    <aside className="w-80 sm:w-84 max-w-[88vw] sm:max-w-sm border-r bg-white flex flex-col h-full shadow-2xl lg:shadow-none">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b bg-white flex justify-between items-center">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-[#2f6bff] flex items-center gap-2">
            Danh sách môn học
          </h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="p-3 sm:p-4 border-b bg-white space-y-2.5">
        {/* Notice when cache has no cohort data */}
        {allSections.length > 0 && !hasCohortData && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5 shadow-2xs">
            <p className="font-semibold flex items-center gap-1.5 text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              Cần nạp lại dữ liệu
            </p>
            <p className="text-[11px] text-amber-700 leading-tight">
              Dữ liệu đang dùng lưu từ phiên trước chưa có cột Khoá học. Vui lòng nạp lại file Excel để kích hoạt lọc khoá học.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 text-xs bg-white hover:bg-amber-100/60 text-amber-900 border-amber-300 font-medium"
              onClick={() => {
                const btn = document.querySelector("[data-file-upload-trigger]") as HTMLButtonElement;
                if (btn) btn.click();
              }}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              Nạp lại file Excel
            </Button>
          </div>
        )}

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Tìm môn, giảng viên, mã lớp..."
            value={filterOptions.searchQuery}
            onChange={(e) => setFilterOptions({ searchQuery: e.target.value })}
            className="pl-9 text-sm h-9"
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

        {/* Dropdown filters for Cohort (Khoá học) and Faculty (Khoa QL) - ALWAYS VISIBLE */}
        <div className="grid grid-cols-2 gap-2">
          {/* Cohort filter */}
          <div>
            <Select
              value={filterOptions.cohortFilter || "all"}
              onValueChange={(val) => setFilterOptions({ cohortFilter: val })}
            >
              <SelectTrigger className="h-8 text-xs px-2 bg-gray-50/70 border-gray-200 hover:bg-gray-100/70 focus:ring-1">
                <div className="flex items-center gap-1.5 truncate">
                  <GraduationCap className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                  <SelectValue placeholder="Khoá học" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-medium">
                  Tất cả khoá
                </SelectItem>
                {cohortOptions.map((cohort) => (
                  <SelectItem key={cohort} value={cohort} className="text-xs">
                    {formatCohortLabel(cohort)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Faculty filter */}
          <div>
            <Select
              value={filterOptions.facultyFilter || "all"}
              onValueChange={(val) => setFilterOptions({ facultyFilter: val })}
            >
              <SelectTrigger className="h-8 text-xs px-2 bg-gray-50/70 border-gray-200 hover:bg-gray-100/70 focus:ring-1">
                <div className="flex items-center gap-1.5 truncate">
                  <Building2 className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                  <SelectValue placeholder="Khoa QL" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-medium">
                  Tất cả khoa
                </SelectItem>
                {facultyOptions.map((fac) => (
                  <SelectItem key={fac} value={fac} className="text-xs">
                    Khoa {fac}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active filter status and reset button */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-gray-500">Đang lọc kết quả</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-6 px-2 text-[11px] text-gray-500 hover:text-red-600 gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Đặt lại
            </Button>
          </div>
        )}
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
            filteredCourses.map((course) => (
              <CourseItem
                key={course.id}
                course={course}
                onSelect={onClose}
              />
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
  onSelect?: () => void;
}

function CourseItem({ course, onSelect }: CourseItemProps) {
  const {
    scheduledClasses,
    clickSelectedCourse,
    setClickSelectedCourse,
    setClickSelectedLecturer,
    clearClickSelection,
  } = useScheduleStore();

  // Check if course is registered
  const isRegistered = scheduledClasses.some((sc) => sc.classSection.courseCode === course.courseCode);

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

  // Check registered status for LT and TH separately
  const hasRegisteredTheory = scheduledClasses.some(
    (sc) => sc.classSection.courseCode === course.courseCode && !sc.classSection.isPractical
  );
  const hasRegisteredPractical = scheduledClasses.some(
    (sc) => sc.classSection.courseCode === course.courseCode && sc.classSection.isPractical
  );

  const colorClass = COURSE_COLORS[0];
  const validFaculties = course.faculties?.filter(Boolean) || [];
  const validCohorts = course.cohorts?.filter(Boolean) || [];

  return (
    <div className="relative">
      <div
        onClick={handleClick}
        className={cn(
          "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-xs",
          colorClass,
          isClickSelected && "ring-2 ring-emerald-500 ring-offset-2 shadow-sm",
          isRegistered && "border-dashed opacity-70"
        )}
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm break-words">{course.courseName}</h3>
            </div>
            <p className="text-xs opacity-70 mt-0.5">{course.courseCode}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge
              variant={
                hasRegisteredTheory && (!course.hasPracticalClass || hasRegisteredPractical) ? "success" : "secondary"
              }
              className="shrink-0 pointer-events-none whitespace-nowrap"
            >
              {course.credits} TC
            </Badge>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1 items-center">
          {validFaculties.length > 0 && (
            <span className="text-[10px] h-4 px-1.5 inline-flex items-center rounded font-medium bg-blue-50 text-blue-700 border border-blue-200 pointer-events-none">
              {validFaculties.join(", ")}
            </span>
          )}
          {validCohorts.length > 0 && (
            <span className="text-[10px] h-4 px-1.5 inline-flex items-center rounded font-medium bg-purple-50 text-purple-700 border border-purple-200 pointer-events-none">
              K.{validCohorts.join(", ")}
            </span>
          )}
          {course.hasTheoryClass && (
            <Badge
              variant={hasRegisteredTheory ? "success" : "info"}
              className="text-[10px] h-4 px-1.5 py-0 pointer-events-none"
            >
              {hasRegisteredTheory ? "Đã ĐK LT" : "LT"}
              {course.theoryCredits && ` (${course.theoryCredits} TC)`}
            </Badge>
          )}
          {course.hasPracticalClass && (
            <Badge
              variant={hasRegisteredPractical ? "success" : "warning"}
              className="text-[10px] h-4 px-1.5 py-0 pointer-events-none"
            >
              {hasRegisteredPractical ? "Đã ĐK TH" : "TH"}
              {course.practicalCredits && ` (${course.practicalCredits} TC)`}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
