"use client";

/**
 * Modal tự động xếp thời khóa biểu dựa trên danh sách mã môn học.
 * Cho phép lọc giảng viên, duyệt và xem trước các phương án TKB tối ưu.
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  Sparkles,
  Search,
  X,
  Check,
  Plus,
  Calendar,
  Clock,
  BookOpen,
  AlertCircle,
  Sun,
  Moon,
  CalendarDays,
  Layers,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useScheduleStore } from "@/store/schedule-store";
import {
  generateAutoSchedules,
  getSolutionSections,
  ScheduleSolution,
  AutoSchedulePreferences,
  CourseOptionGroup,
} from "@/lib/auto-scheduler";
import { getProfessorRating } from "@/lib/professor-rating";
import { ProfessorRatingBadge } from "./ProfessorReviewModal";
import { Course, ClassSection } from "@/types";
import { cn } from "@/lib/utils";

const COURSE_PALETTES = [
  {
    bg: "bg-blue-50/95 dark:bg-blue-950/60",
    border: "border-blue-300 dark:border-blue-700",
    text: "text-blue-950 dark:text-blue-200",
    badge: "bg-blue-100/90 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border-blue-200 dark:border-blue-700",
  },
  {
    bg: "bg-emerald-50/95 dark:bg-emerald-950/60",
    border: "border-emerald-300 dark:border-emerald-700",
    text: "text-emerald-950 dark:text-emerald-200",
    badge: "bg-emerald-100/90 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700",
  },
  {
    bg: "bg-purple-50/95 dark:bg-purple-950/60",
    border: "border-purple-300 dark:border-purple-700",
    text: "text-purple-950 dark:text-purple-200",
    badge: "bg-purple-100/90 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 border-purple-200 dark:border-purple-700",
  },
  {
    bg: "bg-amber-50/95 dark:bg-amber-950/60",
    border: "border-amber-300 dark:border-amber-700",
    text: "text-amber-950 dark:text-amber-200",
    badge: "bg-amber-100/90 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border-amber-200 dark:border-amber-700",
  },
  {
    bg: "bg-rose-50/95 dark:bg-rose-950/60",
    border: "border-rose-300 dark:border-rose-700",
    text: "text-rose-950 dark:text-rose-200",
    badge: "bg-rose-100/90 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 border-rose-200 dark:border-rose-700",
  },
  {
    bg: "bg-cyan-50/95 dark:bg-cyan-950/60",
    border: "border-cyan-300 dark:border-cyan-700",
    text: "text-cyan-950 dark:text-cyan-200",
    badge: "bg-cyan-100/90 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-700",
  },
  {
    bg: "bg-indigo-50/95 dark:bg-indigo-950/60",
    border: "border-indigo-300 dark:border-indigo-700",
    text: "text-indigo-950 dark:text-indigo-200",
    badge: "bg-indigo-100/90 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700",
  },
  {
    bg: "bg-teal-50/95 dark:bg-teal-950/60",
    border: "border-teal-300 dark:border-teal-700",
    text: "text-teal-950 dark:text-teal-200",
    badge: "bg-teal-100/90 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300 border-teal-200 dark:border-teal-700",
  },
];

interface AutoScheduleModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

export function AutoScheduleModal({ open, onOpenChange, trigger }: AutoScheduleModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? (onOpenChange || (() => { })) : setInternalOpen;

  const {
    allSections,
    allCourses,
    applySectionsToCurrentSchedule,
  } = useScheduleStore();

  // State nhập liệu
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);
  const [courseSearch, setCourseSearch] = useState("");

  // Tùy chọn ưu tiên (gồm cả ưu tiên giảng viên)
  const [preferences, setPreferences] = useState<AutoSchedulePreferences>({
    timePreference: "all",
    avoidSaturday: false,
    avoidEvening: true,
    preferredLecturers: {},
  });

  // State kết quả
  const [isSolving, setIsSolving] = useState(false);
  const [solutions, setSolutions] = useState<ScheduleSolution[]>([]);
  const [selectedSolutionIndex, setSelectedSolutionIndex] = useState(0);
  const [hasSolved, setHasSolved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Tự động làm mới lựa chọn trong sắp xếp nhanh khi dữ liệu thời khóa biểu thay đổi
  useEffect(() => {
    setSelectedCourseCodes([]);
    setPreferences({
      timePreference: "all",
      avoidSaturday: false,
      avoidEvening: true,
      preferredLecturers: {},
    });
    setSolutions([]);
    setHasSolved(false);
    setErrorMessage(null);
    setWarningMessage(null);
    setCourseSearch("");
  }, [allSections, allCourses]);

  // Môn học đã chọn (đối tượng Course)
  const selectedCourses = useMemo(() => {
    const map = new Map<string, Course>();
    for (const c of allCourses) {
      map.set(c.courseCode.toUpperCase(), c);
    }
    return selectedCourseCodes
      .map((code) => map.get(code.toUpperCase()))
      .filter((c): c is Course => !!c);
  }, [selectedCourseCodes, allCourses]);

  // Tổng tín chỉ dự kiến
  const totalSelectedCredits = useMemo(() => {
    return selectedCourses.reduce((sum, c) => sum + (c.credits || 0), 0);
  }, [selectedCourses]);

  // Danh sách gợi ý tìm kiếm môn học
  const searchResults = useMemo(() => {
    if (!courseSearch.trim()) return [];
    const q = courseSearch.toLowerCase();
    return allCourses
      .filter(
        (c) =>
          !selectedCourseCodes.includes(c.courseCode.toUpperCase()) &&
          (c.courseCode.toLowerCase().includes(q) || c.courseName.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [courseSearch, allCourses, selectedCourseCodes]);

  // Danh sách các môn có từ 2 giảng viên trở lên để cho phép người dùng chọn ưu tiên
  const coursesWithMultipleLecturers = useMemo(() => {
    return selectedCourses
      .map((course) => {
        const codeKey = course.courseCode.toUpperCase();
        const courseSections = allSections.filter(
          (s) => s.courseCode.toUpperCase() === codeKey
        );
        const lecturers = Array.from(
          new Set(
            courseSections
              .map((s) => s.lecturer?.trim())
              .filter((l): l is string => Boolean(l && l !== "Chưa có thông tin" && l !== "Chưa có" && l !== "*"))
          )
        ).sort();

        return {
          course,
          codeKey,
          lecturers,
        };
      })
      .filter((item) => item.lecturers.length > 1);
  }, [selectedCourses, allSections]);

  // Thêm mã môn
  const handleAddCourseCode = (codeToAdd: string) => {
    const rawCodes = codeToAdd
      .split(/[\s,;\n]+/)
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length > 0);

    const newCodes = [...selectedCourseCodes];
    let addedCount = 0;

    for (const code of rawCodes) {
      if (!newCodes.includes(code)) {
        newCodes.push(code);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      setSelectedCourseCodes(newCodes);
      setCourseSearch("");
      setHasSolved(false);
    }
  };

  // Xóa mã môn
  const handleRemoveCourseCode = (codeToRemove: string) => {
    setSelectedCourseCodes((prev) => prev.filter((c) => c !== codeToRemove));
    setPreferences((prev) => {
      const nextPref = { ...(prev.preferredLecturers || {}) };
      delete nextPref[codeToRemove];
      return { ...prev, preferredLecturers: nextPref };
    });
    setHasSolved(false);
  };

  // Xóa tất cả môn đã chọn
  const handleClearAll = () => {
    setSelectedCourseCodes([]);
    setSolutions([]);
    setHasSolved(false);
    setErrorMessage(null);
    setPreferences((prev) => ({ ...prev, preferredLecturers: {} }));
  };

  // Thực hiện xếp lịch tự động
  const handleRunAutoSchedule = () => {
    if (selectedCourseCodes.length === 0) {
      toast.error("Vui lòng chọn ít nhất 1 mã môn học");
      return;
    }

    setIsSolving(true);
    setErrorMessage(null);
    setWarningMessage(null);

    setTimeout(() => {
      try {
        const result = generateAutoSchedules(
          selectedCourseCodes,
          allSections,
          allCourses,
          preferences,
          50
        );

        setHasSolved(true);
        if (result.success && result.solutions.length > 0) {
          setSolutions(result.solutions);
          setSelectedSolutionIndex(0);
          toast.success(result.message);

          // Hiển thị warning nếu có môn bị bỏ qua hoặc fallback GV
          const warnings: string[] = [];
          if (result.missingCourses.length > 0) {
            warnings.push(`Môn bị bỏ qua: ${result.missingCourses.join(", ")}`);
          }
          if (result.lecturerFallbackCourses.length > 0) {
            warnings.push(`GV ưu tiên không áp dụng được: ${result.lecturerFallbackCourses.join(", ")}`);
          }
          setWarningMessage(warnings.length > 0 ? warnings.join(" • ") : null);
        } else {
          setSolutions([]);
          setErrorMessage(result.message);
          setWarningMessage(null);
          toast.error(result.message);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Có lỗi xảy ra khi xếp lịch";
        setErrorMessage(msg);
        setWarningMessage(null);
        toast.error(msg);
      } finally {
        setIsSolving(false);
      }
    }, 50);
  };

  // Đổi giảng viên / lớp cho 1 môn trong phương án hiện tại
  const handleOptionChange = (courseIdx: number, newOptionIndex: number) => {
    setSolutions((prevSolutions) => {
      const next = [...prevSolutions];
      const targetSol = { ...next[selectedSolutionIndex] };
      const nextItems = targetSol.courseItems.map((item, idx) =>
        idx === courseIdx ? { ...item, selectedOptionIndex: newOptionIndex } : item
      );
      targetSol.courseItems = nextItems;
      targetSol.sections = getSolutionSections(nextItems);
      next[selectedSolutionIndex] = targetSol;
      return next;
    });
  };

  // Áp dụng vào TKB hiện tại
  const handleApplyToCurrent = (solution: ScheduleSolution) => {
    applySectionsToCurrentSchedule(solution.sections);
    toast.success(`Đã áp dụng phương án (${solution.sections.length} lớp học) vào TKB hiện tại!`);
    setIsOpen(false);
  };

  const currentSolution = solutions[selectedSolutionIndex];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : null}

      <DialogContent className="w-[96vw] sm:max-w-4xl lg:max-w-5xl h-[92vh] max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-2 sm:px-5 sm:py-2.5 border-b bg-gradient-to-r from-emerald-500/15 via-background to-background shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2">
                  Sắp xếp nhanh Thời Khóa Biểu
                </DialogTitle>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x">
          <div className="w-full md:w-[340px] lg:w-[350px] p-3 sm:p-3.5 flex flex-col gap-3 overflow-y-auto shrink-0 max-h-[45vh] md:max-h-full">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                1. Chọn môn học
              </label>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo tên hoặc mã môn"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && courseSearch.trim()) {
                      e.preventDefault();
                      if (searchResults.length > 0) {
                        handleAddCourseCode(searchResults[0].courseCode);
                      } else {
                        handleAddCourseCode(courseSearch);
                      }
                    }
                  }}
                  className="pl-8 pr-7 h-9 text-xs bg-muted/30 focus-visible:bg-background"
                />
                {courseSearch && (
                  <button
                    type="button"
                    onClick={() => setCourseSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
                    title="Xóa tìm kiếm"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-popover border rounded-md shadow-lg p-1 space-y-0.5 max-h-48 overflow-y-auto">
                    {searchResults.map((course) => (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => handleAddCourseCode(course.courseCode)}
                        className="w-full text-left px-2.5 py-1.5 rounded text-xs hover:bg-emerald-500/10 flex items-center justify-between transition-colors"
                      >
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{course.courseCode}</span>
                        <span className="truncate flex-1 mx-2 text-foreground">{course.courseName}</span>
                        <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
                          {course.credits} TC
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-[90px] flex flex-col space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span>Môn đã chọn ({selectedCourseCodes.length})</span>
                  {selectedCourseCodes.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-[11px] text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium hover:underline transition-colors normal-case"
                    >
                      Xóa tất cả
                    </button>
                  )}
                </div>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">{totalSelectedCredits} Tín chỉ</span>
              </div>

              <div className="border rounded-lg p-2 bg-muted/20 flex-1 overflow-y-auto max-h-32 min-h-[70px]">
                {selectedCourseCodes.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-3 text-muted-foreground text-xs">
                    <BookOpen className="h-6 w-6 mb-1 opacity-40" />
                    <span>Chưa có môn nào được chọn.</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCourseCodes.map((code) => {
                      const courseInfo = allCourses.find(
                        (c) => c.courseCode.toUpperCase() === code.toUpperCase()
                      );
                      const isFound = !!courseInfo;

                      return (
                        <div
                          key={code}
                          className={cn(
                            "inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md text-xs border font-medium transition-all shadow-sm",
                            isFound
                              ? "bg-background border-border text-foreground"
                              : "bg-red-50 text-red-700 border-red-200"
                          )}
                          title={courseInfo ? `${courseInfo.courseName} (${courseInfo.credits} TC)` : "Không tìm thấy môn này trong dữ liệu"}
                        >
                          <span className={cn("font-bold", isFound ? "text-emerald-700 dark:text-emerald-400" : "text-red-600")}>
                            {code}
                          </span>
                          {courseInfo && (
                            <span className="text-[10px] text-muted-foreground hidden sm:inline truncate max-w-[100px]">
                              {courseInfo.courseName}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveCourseCode(code)}
                            className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 border-t pt-3">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                2. Tiêu chí xếp lịch
              </label>

              <div className="grid grid-cols-2 gap-2 text-xs bg-muted/20 p-2.5 rounded-lg border">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={preferences.timePreference === "compact_days"}
                    onChange={(e) =>
                      setPreferences((p) => ({
                        ...p,
                        timePreference: e.target.checked ? "compact_days" : "all",
                      }))
                    }
                    className="accent-emerald-600 dark:accent-emerald-500 rounded border-border h-3.5 w-3.5 cursor-pointer"
                  />
                  <span className="font-medium">Ít ngày nhất</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={preferences.avoidSaturday}
                    onChange={(e) =>
                      setPreferences((p) => ({
                        ...p,
                        avoidSaturday: e.target.checked,
                      }))
                    }
                    className="accent-emerald-600 dark:accent-emerald-500 rounded border-border h-3.5 w-3.5 cursor-pointer"
                  />
                  <span className="font-medium">Không học T7</span>
                </label>
              </div>
            </div>

            {coursesWithMultipleLecturers.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  3. Ưu tiên giảng viên
                </label>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {coursesWithMultipleLecturers.map(({ course, codeKey, lecturers }) => {
                    const currentPreferred =
                      preferences.preferredLecturers?.[codeKey] ||
                      preferences.preferredLecturers?.[course.courseCode] ||
                      "all";

                    return (
                      <div key={codeKey} className="space-y-1 bg-muted/20 p-2 rounded border border-border/50">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">{course.courseCode}</span>
                          <span
                            className="text-muted-foreground truncate max-w-[170px]"
                            title={course.courseName}
                          >
                            {course.courseName}
                          </span>
                        </div>

                        <Select
                          value={currentPreferred}
                          onValueChange={(val) => {
                            setPreferences((p) => {
                              const next = { ...(p.preferredLecturers || {}) };
                              if (val === "all") {
                                delete next[codeKey];
                                delete next[course.courseCode];
                              } else {
                                next[codeKey] = val;
                              }
                              return { ...p, preferredLecturers: next };
                            });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs bg-background">
                            <SelectValue placeholder="Bất kỳ giảng viên nào" />
                          </SelectTrigger>
                          <SelectContent className="max-h-48">
                            <SelectItem value="all" className="text-xs">
                              Bất kỳ giảng viên nào ({lecturers.length} GV)
                            </SelectItem>
                            {lecturers.map((lecturer) => {
                              const ratingInfo = getProfessorRating(lecturer);
                              return (
                                <SelectItem key={lecturer} value={lecturer} className="text-xs">
                                  {lecturer}
                                  {ratingInfo && ` (⭐ ${ratingInfo.averageRating.toFixed(1)} - ${ratingInfo.totalReviews} ĐG)`}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Button
              onClick={handleRunAutoSchedule}
              disabled={selectedCourseCodes.length === 0 || isSolving}
              className="w-full gap-2 font-bold shadow-md h-10 mt-auto bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {isSolving ? "Đang xếp lịch..." : "Tìm phương án"}
            </Button>
          </div>

          <div className="flex-1 flex flex-col p-3 sm:p-3.5 overflow-hidden bg-background">
            {!hasSolved ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                <h3 className="font-semibold text-base text-foreground mb-1">
                  Vui lòng chọn môn học để tự động sắp xếp.
                </h3>
              </div>
            ) : solutions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                <AlertCircle className="h-12 w-12 text-amber-500 mb-3" />
                <h3 className="font-semibold text-base text-foreground mb-1">
                  Không tìm thấy phương án phù hợp
                </h3>

                <div className="text-xs text-muted-foreground space-y-1 bg-muted/40 p-3 rounded-lg border text-left max-w-md">
                  <p className="font-semibold text-foreground">Gợi ý khắc phục:</p>
                  <p>• Thử bỏ bớt 1 môn học.</p>
                  <p>• Bỏ chọn các tiêu chí hạn chế.</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden gap-2">
                {warningMessage && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-300 shrink-0">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-semibold">Lưu ý</p>
                      <p className="text-amber-700 dark:text-amber-400">{warningMessage}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 border-b pb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm sm:text-base text-foreground">
                      Tìm thấy {solutions.length} phương án
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setSelectedSolutionIndex((prev) => Math.max(0, prev - 1))}
                      disabled={selectedSolutionIndex === 0}
                      title="Phương án trước"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <Select
                      value={String(selectedSolutionIndex)}
                      onValueChange={(val) => setSelectedSolutionIndex(Number(val))}
                    >
                      <SelectTrigger className="h-8 text-xs font-semibold w-[160px] sm:w-[190px]">
                        <SelectValue placeholder="Chọn phương án" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {solutions.map((sol, idx) => (
                          <SelectItem key={sol.id} value={String(idx)} className="text-xs font-medium">
                            Phương án {idx + 1}: {sol.dayCount} ngày
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setSelectedSolutionIndex((prev) => Math.min(solutions.length - 1, prev + 1))}
                      disabled={selectedSolutionIndex === solutions.length - 1}
                      title="Phương án tiếp theo"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {currentSolution && (
                  <div className="flex-1 flex flex-col justify-between overflow-y-auto gap-2.5 min-h-0">
                    <div className="border rounded-lg overflow-hidden flex flex-col bg-card shadow-xs shrink-0">
                      <div className="px-3 py-1.5 border-b bg-muted/30 font-semibold text-xs flex items-center justify-between shrink-0">
                        <span className="flex items-center gap-1.5 font-bold text-xs">
                          <Calendar className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          Thời khóa biểu tuần
                        </span>
                        <span className="text-[11px] text-muted-foreground font-normal">
                          {currentSolution.courseItems.length} môn • {currentSolution.totalCredits} Tín chỉ
                        </span>
                      </div>

                      <div className="p-1.5 flex flex-col">
                        <InteractiveTimetableGrid
                          solution={currentSolution}
                          onOptionChange={handleOptionChange}
                        />
                      </div>
                    </div>

                    <div className="p-2.5 border rounded-lg bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
                      <div className="text-xs text-muted-foreground">
                        Đang chọn: <span className="font-bold text-foreground">Phương án {selectedSolutionIndex + 1}</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleApplyToCurrent(currentSolution)}
                        className="h-8 gap-1.5 text-xs font-semibold px-4 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500"
                        title="Áp dụng phương án vào TKB hiện tại"
                      >
                        <Check className="h-4 w-4" />
                        Áp dụng
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InteractiveTimetableGrid({
  solution,
  onOptionChange,
}: {
  solution: ScheduleSolution;
  onOptionChange: (courseIdx: number, newOptionIndex: number) => void;
}) {
  const days = [2, 3, 4, 5, 6, 7];
  const periods = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const CELL_HEIGHT = 28;

  const scheduledItems = useMemo(() => {
    const items: Array<{
      id: string;
      section: ClassSection;
      courseCode: string;
      courseName: string;
      courseIdx: number;
      availableOptions: CourseOptionGroup[];
      selectedOptionIndex: number;
    }> = [];

    const flexibleItems: typeof items = [];

    solution.courseItems.forEach((courseItem, courseIdx) => {
      const currentOpt =
        courseItem.availableOptions[courseItem.selectedOptionIndex] || courseItem.availableOptions[0];

      if (!currentOpt) return;

      currentOpt.sections.forEach((sec) => {
        const itemObj = {
          id: `${sec.id}-${courseItem.courseCode}`,
          section: sec,
          courseCode: courseItem.courseCode,
          courseName: courseItem.courseName,
          courseIdx,
          availableOptions: courseItem.availableOptions,
          selectedOptionIndex: courseItem.selectedOptionIndex,
        };

        if (sec.dayOfWeek !== null && sec.startPeriod && sec.periodCount) {
          items.push(itemObj);
        } else {
          flexibleItems.push(itemObj);
        }
      });
    });

    return { scheduled: items, flexible: flexibleItems };
  }, [solution]);

  return (
    <div className="w-full text-xs flex flex-col gap-1.5">
      <div className="border rounded-md overflow-hidden bg-background overflow-x-auto">
        <div className="min-w-[420px]">
          <div className="grid grid-cols-[32px_repeat(6,1fr)] border-b bg-muted/40 font-semibold text-center text-muted-foreground">
            <div className="py-1 text-[10px] border-r">Tiết</div>
            {days.map((d) => (
              <div key={d} className="py-1 text-[11px] font-bold text-foreground border-r last:border-r-0">
                Thứ {d}
              </div>
            ))}
          </div>

        <div className="relative">
          <div className="divide-y divide-border/40">
            {periods.map((p) => (
              <div
                key={p}
                style={{ height: CELL_HEIGHT }}
                className={cn(
                  "grid grid-cols-[32px_repeat(6,1fr)] items-center text-center",
                  p === 5 && "border-b-2 border-emerald-500/30"
                )}
              >
                <div className="h-full border-r flex items-center justify-center text-[10px] text-muted-foreground font-mono font-medium bg-muted/10">
                  {p}
                </div>

                {days.map((d) => (
                  <div
                    key={d}
                    className="h-full border-r last:border-r-0 hover:bg-muted/10 transition-colors"
                  />
                ))}
              </div>
            ))}
          </div>

          {scheduledItems.scheduled.map((item) => {
            const dayIdx = days.indexOf(item.section.dayOfWeek!);
            if (dayIdx === -1) return null;

            const dayWidthPct = 100 / 6;
            const leftPct = dayIdx * dayWidthPct;
            const top = (item.section.startPeriod - 1) * CELL_HEIGHT + 1;
            const height = item.section.periodCount * CELL_HEIGHT - 2;

            return (
              <div
                key={item.id}
                style={{
                  position: "absolute",
                  left: `calc(32px + (100% - 32px) * ${leftPct / 100})`,
                  width: `calc((100% - 32px) * ${dayWidthPct / 100})`,
                  top,
                  height,
                  padding: "0 1.5px",
                }}
                className="z-10"
              >
                <div
                  className="h-full rounded-md border p-1 flex flex-col justify-between shadow-2xs transition-all bg-green-100 border-green-300 text-green-950 dark:bg-[#063b2c] dark:border-green-700 dark:text-green-100 hover:border-green-500/80 overflow-hidden"
                >
                  <div className="min-w-0 space-y-0.5 leading-tight">
                    <div className="flex items-start justify-between gap-0.5 leading-none">
                      <span
                        className="font-bold text-[9.5px] text-green-800 dark:text-green-300 break-all leading-tight font-mono"
                        title={item.section.classCode}
                      >
                        {item.section.classCode}
                      </span>
                      <span className="text-[7.5px] font-bold px-1 py-0.5 rounded bg-green-200 text-green-950 dark:bg-green-900 dark:text-green-200 shrink-0 leading-none border border-green-300 dark:border-green-700">
                        {item.section.isPractical ? "TH" : "LT"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 min-w-0">
                      <p
                        className="text-[9px] leading-tight text-green-950/90 dark:text-green-200 font-medium truncate"
                        title={item.section.lecturer}
                      >
                        GV: {item.section.lecturer || "Chưa có"}
                      </p>
                      {item.section.lecturer && (
                        <ProfessorRatingBadge lecturerName={item.section.lecturer} size="sm" showText={false} />
                      )}
                    </div>
                  </div>

                  {item.availableOptions.length > 1 && (
                    <div className="pt-0.5 mt-auto" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={String(item.selectedOptionIndex)}
                        onValueChange={(val) =>
                          item.courseIdx !== undefined && onOptionChange(item.courseIdx, Number(val))
                        }
                      >
                        <SelectTrigger className="h-4.5 text-[8.5px] font-semibold bg-background py-0 px-1 border border-green-500/40 text-green-900 dark:text-green-200 rounded shadow-2xs hover:bg-green-50 dark:hover:bg-green-950/50">
                          <span className="truncate">Đổi Giảng Viên</span>
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {item.availableOptions.map((opt, optIdx) => (
                            <SelectItem key={opt.id} value={String(optIdx)} className="text-xs">
                              {opt.dropdownLabel ||
                                `${opt.theoryClassCode || ""}${opt.practicalClassCode ? ` + ${opt.practicalClassCode}` : ""} - ${opt.lecturerSummary}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {scheduledItems.flexible.length > 0 && (
        <div className="p-1.5 border rounded-md bg-muted/20 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-muted-foreground shrink-0 text-[11px]">Thời gian linh hoạt:</span>
          {scheduledItems.flexible.map((fItem) => (
            <div
              key={fItem.id}
              className="p-1 px-2 rounded border flex items-center gap-2 bg-green-100 border-green-300 text-green-950 dark:bg-[#063b2c] dark:border-green-700 dark:text-green-100 text-[11px]"
            >
              <span className="font-bold text-green-800 dark:text-green-300">{fItem.section.classCode}</span>
              <span>GV: {fItem.section.lecturer || "Chưa có"}</span>
              {fItem.availableOptions.length > 1 && (
                <Select
                  value={String(fItem.selectedOptionIndex)}
                  onValueChange={(val) => onOptionChange(fItem.courseIdx, Number(val))}
                >
                  <SelectTrigger className="h-5 text-[9px] bg-background font-medium px-1.5 py-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fItem.availableOptions.map((opt, optIdx) => (
                      <SelectItem key={opt.id} value={String(optIdx)} className="text-xs">
                        {opt.dropdownLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AutoScheduleModal;
