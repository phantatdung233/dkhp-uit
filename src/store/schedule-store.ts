/**
 * Zustand Store quản lý toàn bộ trạng thái thời khóa biểu (State Management).
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { ClassSection, Course, ScheduledClass, Conflict, FilterOptions, HighlightedSlot, Schedule } from "@/types";
import {
  checkConflictWithSchedule,
  checkMissingPairedClass,
  getHighlightedSlots,
  getTotalCredits,
} from "@/lib/schedule-utils";
import {
  filterValidSections,
  checkDuplicateTypeRegistration,
  validatePracticalWithPendingTheory,
  findPairedClass,
  getConflictingScheduledClasses,
} from "./schedule-store-helpers";

interface ScheduleState {
  allSections: ClassSection[];
  allCourses: Course[];
  schedules: Schedule[];
  currentScheduleId: string;
  scheduledClasses: ScheduledClass[];
  warnings: Conflict[];

  highlightedSlots: HighlightedSlot[];
  filterOptions: FilterOptions;
  clickSelectedCourse: Course | null;
  clickSelectedLecturer: string | null;
  clickSelectedType: "theory" | "practical" | null;

  /** Lớp lý thuyết đang chờ chọn lớp thực hành tương ứng */
  pendingTheorySection: ClassSection | null;

  isClassSelectionModalOpen: boolean;
  classSelectionOptions: ClassSection[];
  pendingSlot: { dayOfWeek: number; period: number } | null;

  isReplaceModalOpen: boolean;
  replaceModalData: { newSection: ClassSection; conflictingClasses: ScheduledClass[] } | null;

  isLoading: boolean;
  errorMessage: string | null;
  totalCredits: number;

  // Actions
  setAllSections: (sections: ClassSection[]) => void;
  setAllCourses: (courses: Course[]) => void;
  importData: (sections: ClassSection[], courses: Course[]) => void;
  clearData: () => void;

  addClassToSchedule: (
    section: ClassSection,
    skipPracticalPrompt?: boolean
  ) => { success: boolean; conflicts: Conflict[]; error?: string; pendingPractical?: boolean };
  replaceClassWithSection: (newSection: ClassSection) => {
    success: boolean;
    conflicts: Conflict[];
    error?: string;
    removedClasses?: ClassSection[];
    pendingPractical?: boolean;
  };
  removeClassFromSchedule: (classId: string) => void;
  clearSchedule: () => void;

  addSchedule: (name?: string) => void;
  removeSchedule: (id: string) => void;
  switchSchedule: (id: string) => void;
  renameSchedule: (id: string, name: string) => void;
  applySectionsToCurrentSchedule: (sections: ClassSection[]) => void;
  createScheduleWithSections: (name: string, sections: ClassSection[]) => boolean;

  updateHighlightedSlots: () => void;
  setFilterOptions: (options: Partial<FilterOptions>) => void;
  resetFilters: () => void;
  setClickSelectedCourse: (course: Course | null) => void;
  setClickSelectedLecturer: (lecturer: string | null) => void;
  clearClickSelection: () => void;
  openClassSelectionModal: (options: ClassSection[], slot: { dayOfWeek: number; period: number }) => void;
  closeClassSelectionModal: () => void;
  selectClassFromModal: (section: ClassSection) => void;
  openReplaceModal: (newSection: ClassSection, conflictingClasses: ScheduledClass[]) => void;
  closeReplaceModal: () => void;
  confirmReplace: () => void;

  setLoading: (loading: boolean) => void;
  setError: (message: string | null) => void;
  dismissWarning: (warningId: string) => void;
}

export const useScheduleStore = create<ScheduleState>()(
  devtools(
    persist(
      (set, get) => ({
        allSections: [],
        allCourses: [],
        schedules: [
          {
            id: "default",
            name: "Lịch 1",
            scheduledClasses: [],
            totalCredits: 0,
            warnings: [],
            createdAt: Date.now(),
          },
        ],
        currentScheduleId: "default",
        scheduledClasses: [],
        warnings: [],
        totalCredits: 0,
        highlightedSlots: [],
        filterOptions: {
          searchQuery: "",
          lecturerFilter: "",
          showUnregisteredOnly: false,
          classType: "all",
          cohortFilter: "all",
          facultyFilter: "all",
        },
        clickSelectedCourse: null,
        clickSelectedLecturer: null,
        clickSelectedType: null,
        pendingTheorySection: null,
        isClassSelectionModalOpen: false,
        classSelectionOptions: [],
        pendingSlot: null,
        isReplaceModalOpen: false,
        replaceModalData: null,
        isLoading: false,
        errorMessage: null,

        setAllSections: (sections) => set({ allSections: sections }),

        setAllCourses: (courses) => set({ allCourses: courses }),

        importData: (sections, courses) =>
          set({
            allSections: sections,
            allCourses: courses,
            schedules: [
              {
                id: "default",
                name: "Lịch 1",
                scheduledClasses: [],
                totalCredits: 0,
                warnings: [],
                createdAt: Date.now(),
              },
            ],
            currentScheduleId: "default",
            scheduledClasses: [],
            warnings: [],
            totalCredits: 0,
            highlightedSlots: [],
            clickSelectedCourse: null,
            clickSelectedLecturer: null,
            clickSelectedType: null,
            pendingTheorySection: null,
            isClassSelectionModalOpen: false,
            classSelectionOptions: [],
            pendingSlot: null,
            isReplaceModalOpen: false,
            replaceModalData: null,
            errorMessage: null,
          }),

        clearData: () =>
          set({
            allSections: [],
            allCourses: [],
            schedules: [
              {
                id: "default",
                name: "Lịch 1",
                scheduledClasses: [],
                totalCredits: 0,
                warnings: [],
                createdAt: Date.now(),
              },
            ],
            currentScheduleId: "default",
            scheduledClasses: [],
            warnings: [],
            totalCredits: 0,
            highlightedSlots: [],
            clickSelectedCourse: null,
            clickSelectedLecturer: null,
            clickSelectedType: null,
            pendingTheorySection: null,
            isClassSelectionModalOpen: false,
            classSelectionOptions: [],
            pendingSlot: null,
            isReplaceModalOpen: false,
            replaceModalData: null,
            errorMessage: null,
          }),

        addClassToSchedule: (section, skipPracticalPrompt = false) => {
          const state = get();

          // Kiểm tra xem môn này đã có lớp cùng loại (LT hoặc TH) trong lịch chưa
          const duplicateCheck = checkDuplicateTypeRegistration(section, state.scheduledClasses);
          if (duplicateCheck.isDuplicate) {
            return {
              success: false,
              conflicts: [],
              error: `Bạn đã đăng ký lớp ${duplicateCheck.typeStr} cho môn "${section.courseName}" rồi!`,
            };
          }

          // Kiểm tra tính khớp mã giữa lớp LT và TH
          const practicalValidation = validatePracticalWithPendingTheory(section, state.pendingTheorySection);
          if (!practicalValidation.isValid) {
            return {
              success: false,
              conflicts: [],
              error: practicalValidation.error,
            };
          }

          // Kiểm tra xung đột thời gian với các lớp đã có
          const conflicts = checkConflictWithSchedule(section, state.scheduledClasses);
          if (conflicts.length > 0) {
            return { success: false, conflicts };
          }

          // Nếu thêm lớp LT và có lớp TH đi kèm, thêm LT trước và mở chế độ chờ chọn TH
          if (!section.isPractical && !skipPracticalPrompt) {
            const practicalSections = state.allSections.filter(
              (s) =>
                s.courseCode === section.courseCode && s.isPractical && s.classCode.startsWith(section.classCode + ".")
            );

            if (practicalSections.length > 0) {
              const newScheduledClass: ScheduledClass = {
                id: `scheduled-${section.id}-${Date.now()}`,
                classSection: section,
                addedAt: new Date(),
              };

              const newScheduledClasses = [...state.scheduledClasses, newScheduledClass];
              const newSchedules = state.schedules.map((s) =>
                s.id === state.currentScheduleId
                  ? {
                      ...s,
                      scheduledClasses: newScheduledClasses,
                      totalCredits: getTotalCredits(newScheduledClasses),
                    }
                  : s
              );

              set({
                scheduledClasses: newScheduledClasses,
                totalCredits: getTotalCredits(newScheduledClasses),
                schedules: newSchedules,
                pendingTheorySection: section,
              });
              get().updateHighlightedSlots();
              return { success: true, conflicts: [], pendingPractical: true };
            }
          }

          // Kiểm tra giới hạn 30 tín chỉ mỗi học kỳ
          const currentCredits = state.totalCredits;
          const addedCredits = section.credits;

          if (currentCredits + addedCredits > 30) {
            return {
              success: false,
              conflicts: [],
              error: `Vượt quá giới hạn 30 tín chỉ! (Hiện tại: ${currentCredits} TC)`,
            };
          }

          let newScheduledClasses = [...state.scheduledClasses];
          newScheduledClasses.push({
            id: `scheduled-${section.id}-${Date.now()}`,
            classSection: section,
            addedAt: new Date(),
          });

          const missingWarning = checkMissingPairedClass(section, newScheduledClasses, state.allSections);
          const newWarnings = missingWarning
            ? [...state.warnings.filter((w) => w.id !== missingWarning.id), missingWarning]
            : state.warnings;

          const newSchedules = state.schedules.map((s) =>
            s.id === state.currentScheduleId
              ? {
                  ...s,
                  scheduledClasses: newScheduledClasses,
                  warnings: newWarnings,
                  totalCredits: getTotalCredits(newScheduledClasses),
                }
              : s
          );

          set({
            scheduledClasses: newScheduledClasses,
            warnings: newWarnings,
            totalCredits: getTotalCredits(newScheduledClasses),
            schedules: newSchedules,
            clickSelectedCourse: null,
            clickSelectedLecturer: null,
            pendingTheorySection: null,
            highlightedSlots: [],
          });

          return { success: true, conflicts: [] };
        },

        replaceClassWithSection: (newSection) => {
          const state = get();
          const conflicting = getConflictingScheduledClasses(newSection, state.scheduledClasses);
          const conflictingIds = conflicting.map((c) => c.id);

          let newScheduledClasses = state.scheduledClasses.filter((sc) => !conflictingIds.includes(sc.id));

          const newScheduledClass: ScheduledClass = {
            id: `scheduled-${newSection.id}-${Date.now()}`,
            classSection: newSection,
            addedAt: new Date(),
          };

          newScheduledClasses.push(newScheduledClass);

          const practicalSections = !newSection.isPractical
            ? state.allSections.filter(
                (s) =>
                  s.courseCode === newSection.courseCode &&
                  s.isPractical &&
                  s.classCode.startsWith(newSection.classCode + ".")
              )
            : [];

          const hasPendingPractical = !newSection.isPractical && practicalSections.length > 0;

          const removedSectionIds = conflicting.map((sc) => sc.classSection.id);
          let newWarnings = state.warnings.filter(
            (w) => !w.conflictingClasses.some((c) => removedSectionIds.includes(c.id))
          );

          const missingWarning = checkMissingPairedClass(newSection, newScheduledClasses, state.allSections);
          if (missingWarning) {
            newWarnings = [...newWarnings.filter((w) => w.id !== missingWarning.id), missingWarning];
          }

          const newTotalCredits = getTotalCredits(newScheduledClasses);
          const newSchedules = state.schedules.map((s) =>
            s.id === state.currentScheduleId
              ? {
                  ...s,
                  scheduledClasses: newScheduledClasses,
                  warnings: newWarnings,
                  totalCredits: newTotalCredits,
                }
              : s
          );

          set({
            scheduledClasses: newScheduledClasses,
            warnings: newWarnings,
            totalCredits: newTotalCredits,
            schedules: newSchedules,
            pendingTheorySection: hasPendingPractical ? newSection : null,
            clickSelectedCourse: hasPendingPractical ? state.clickSelectedCourse : null,
            clickSelectedLecturer: null,
            highlightedSlots: [],
          });

          get().updateHighlightedSlots();

          return {
            success: true,
            conflicts: [],
            removedClasses: conflicting.map((c) => c.classSection),
            pendingPractical: hasPendingPractical,
          };
        },

        removeClassFromSchedule: (classId) => {
          const state = get();
          const removedClass = state.scheduledClasses.find((sc) => sc.id === classId);

          if (!removedClass) return;

          const removedSection = removedClass.classSection;

          // Xóa kèm lớp đi cùng (LT xóa TH, TH xóa LT)
          const classIdsToRemove = [classId];
          const pairedClass = findPairedClass(removedSection, state.scheduledClasses);
          if (pairedClass) {
            classIdsToRemove.push(pairedClass.id);
          }

          const newScheduledClasses = state.scheduledClasses.filter((sc) => !classIdsToRemove.includes(sc.id));

          const removedSectionIds = state.scheduledClasses
            .filter((sc) => classIdsToRemove.includes(sc.id))
            .map((sc) => sc.classSection.id);

          const newWarnings = state.warnings.filter(
            (w) => !w.conflictingClasses.some((c) => removedSectionIds.includes(c.id))
          );

          const shouldClearPending =
            !removedSection.isPractical && state.pendingTheorySection?.id === removedSection.id;

          const newTotalCredits = getTotalCredits(newScheduledClasses);
          const newSchedules = state.schedules.map((s) =>
            s.id === state.currentScheduleId
              ? { ...s, scheduledClasses: newScheduledClasses, warnings: newWarnings, totalCredits: newTotalCredits }
              : s
          );

          set({
            scheduledClasses: newScheduledClasses,
            warnings: newWarnings,
            totalCredits: newTotalCredits,
            schedules: newSchedules,
            ...(shouldClearPending && {
              pendingTheorySection: null,
              clickSelectedCourse: null,
              clickSelectedLecturer: null,
              highlightedSlots: [],
            }),
          });

          if (!shouldClearPending && state.clickSelectedCourse) {
            get().updateHighlightedSlots();
          }
        },

        clearSchedule: () => {
          const state = get();
          const newSchedules = state.schedules.map((s) =>
            s.id === state.currentScheduleId ? { ...s, scheduledClasses: [], warnings: [], totalCredits: 0 } : s
          );
          set({
            scheduledClasses: [],
            warnings: [],
            totalCredits: 0,
            schedules: newSchedules,
          });
          get().updateHighlightedSlots();
        },

        addSchedule: (name) => {
          const state = get();
          if (state.schedules.length >= 5) return;

          const newId = Date.now().toString();
          const newSchedule: Schedule = {
            id: newId,
            name: name || `Lịch ${state.schedules.length + 1}`,
            scheduledClasses: [],
            totalCredits: 0,
            warnings: [],
            createdAt: Date.now(),
          };

          set({
            schedules: [...state.schedules, newSchedule],
          });
        },

        removeSchedule: (id) => {
          const state = get();
          if (state.schedules.length <= 1) return;

          const newSchedules = state.schedules.filter((s) => s.id !== id);

          if (state.currentScheduleId === id) {
            const firstSchedule = newSchedules[0];
            set({
              schedules: newSchedules,
              currentScheduleId: firstSchedule.id,
              scheduledClasses: firstSchedule.scheduledClasses,
              warnings: firstSchedule.warnings,
              totalCredits: firstSchedule.totalCredits,
            });
          } else {
            set({ schedules: newSchedules });
          }
        },

        switchSchedule: (id) => {
          const state = get();
          const target = state.schedules.find((s) => s.id === id);
          if (!target) return;

          set({
            currentScheduleId: id,
            scheduledClasses: target.scheduledClasses,
            warnings: target.warnings,
            totalCredits: target.totalCredits,
            clickSelectedCourse: null,
            clickSelectedLecturer: null,
            highlightedSlots: [],
            pendingTheorySection: null,
          });
        },

        renameSchedule: (id, name) => {
          const state = get();
          const newSchedules = state.schedules.map((s) => (s.id === id ? { ...s, name } : s));
          set({ schedules: newSchedules });
        },

        applySectionsToCurrentSchedule: (sections) => {
          const state = get();
          const newScheduledClasses: ScheduledClass[] = sections.map((section, idx) => ({
            id: `scheduled-${section.id}-${Date.now()}-${idx}`,
            classSection: section,
            addedAt: new Date(),
          }));
          const totalCredits = getTotalCredits(newScheduledClasses);
          const newSchedules = state.schedules.map((s) =>
            s.id === state.currentScheduleId
              ? {
                  ...s,
                  scheduledClasses: newScheduledClasses,
                  warnings: [],
                  totalCredits,
                }
              : s
          );

          set({
            scheduledClasses: newScheduledClasses,
            warnings: [],
            totalCredits,
            schedules: newSchedules,
            clickSelectedCourse: null,
            clickSelectedLecturer: null,
            pendingTheorySection: null,
            highlightedSlots: [],
          });
          get().updateHighlightedSlots();
        },

        createScheduleWithSections: (name, sections) => {
          const state = get();
          if (state.schedules.length >= 5) return false;

          const newId = Date.now().toString();
          const newScheduledClasses: ScheduledClass[] = sections.map((section, idx) => ({
            id: `scheduled-${section.id}-${Date.now()}-${idx}`,
            classSection: section,
            addedAt: new Date(),
          }));
          const totalCredits = getTotalCredits(newScheduledClasses);

          const newSchedule: Schedule = {
            id: newId,
            name: name || `Lịch ${state.schedules.length + 1}`,
            scheduledClasses: newScheduledClasses,
            totalCredits,
            warnings: [],
            createdAt: Date.now(),
          };

          const newSchedules = [...state.schedules, newSchedule];

          set({
            schedules: newSchedules,
            currentScheduleId: newId,
            scheduledClasses: newScheduledClasses,
            warnings: [],
            totalCredits,
            clickSelectedCourse: null,
            clickSelectedLecturer: null,
            pendingTheorySection: null,
            highlightedSlots: [],
          });
          get().updateHighlightedSlots();
          return true;
        },

        updateHighlightedSlots: () => {
          const state = get();

          if (state.pendingTheorySection) {
            const practicalSections = state.allSections.filter(
              (s) =>
                s.courseCode === state.pendingTheorySection!.courseCode &&
                s.isPractical &&
                s.classCode.startsWith(state.pendingTheorySection!.classCode + ".")
            );

            const highlighted = getHighlightedSlots(practicalSections, state.scheduledClasses, state.allSections);
            set({ highlightedSlots: highlighted });
            return;
          }

          if (state.clickSelectedCourse) {
            let filteredSections = state.clickSelectedLecturer
              ? state.clickSelectedCourse.sections.filter((s) => s.lecturer === state.clickSelectedLecturer)
              : state.clickSelectedCourse.sections;

            const hasTheorySections = filteredSections.some((s) => !s.isPractical);
            if (state.pendingTheorySection || state.clickSelectedType === "practical") {
              filteredSections = filteredSections.filter((s) => s.isPractical);
            } else if (state.clickSelectedType === "theory") {
              filteredSections = filteredSections.filter((s) => !s.isPractical);
            } else if (hasTheorySections) {
              filteredSections = filteredSections.filter((s) => !s.isPractical);
            }

            filteredSections = filterValidSections(
              filteredSections,
              state.scheduledClasses,
              state.pendingTheorySection
            );

            const highlighted = getHighlightedSlots(filteredSections, state.scheduledClasses, state.allSections);
            set({ highlightedSlots: highlighted });
            return;
          }

          set({ highlightedSlots: [] });
        },

        setFilterOptions: (options) => {
          set((state) => ({
            filterOptions: { ...state.filterOptions, ...options },
          }));
          get().updateHighlightedSlots();
        },

        resetFilters: () =>
          set({
            filterOptions: {
              searchQuery: "",
              lecturerFilter: "",
              showUnregisteredOnly: false,
              classType: "all",
              cohortFilter: "all",
              facultyFilter: "all",
            },
          }),

        setClickSelectedCourse: (course) => {
          const state = get();

          if (state.pendingTheorySection && course?.courseCode !== state.pendingTheorySection.courseCode) {
            const theoryScheduledClass = state.scheduledClasses.find(
              (sc) => sc.classSection.id === state.pendingTheorySection!.id
            );
            if (theoryScheduledClass) {
              get().removeClassFromSchedule(theoryScheduledClass.id);
            }
          }

          set({
            clickSelectedCourse: course,
            clickSelectedLecturer: null,
            clickSelectedType: null,
            pendingTheorySection: null,
          });
          get().updateHighlightedSlots();
        },

        setClickSelectedLecturer: (lecturer) => {
          set({ clickSelectedLecturer: lecturer });
          get().updateHighlightedSlots();
        },

        clearClickSelection: () => {
          const state = get();

          if (state.pendingTheorySection) {
            const theoryScheduledClass = state.scheduledClasses.find(
              (sc) => sc.classSection.id === state.pendingTheorySection!.id
            );
            if (theoryScheduledClass) {
              get().removeClassFromSchedule(theoryScheduledClass.id);
            }
          }

          set({
            clickSelectedCourse: null,
            clickSelectedLecturer: null,
            clickSelectedType: null,
            pendingTheorySection: null,
            highlightedSlots: [],
          });
        },

        openClassSelectionModal: (options, slot) =>
          set({
            isClassSelectionModalOpen: true,
            classSelectionOptions: options,
            pendingSlot: slot,
          }),

        closeClassSelectionModal: () =>
          set({
            isClassSelectionModalOpen: false,
            classSelectionOptions: [],
            pendingSlot: null,
          }),

        selectClassFromModal: (section) => {
          const result = get().addClassToSchedule(section);
          if (result.success) {
            get().closeClassSelectionModal();
          }
        },

        openReplaceModal: (newSection, conflictingClasses) =>
          set({
            isReplaceModalOpen: true,
            replaceModalData: { newSection, conflictingClasses },
          }),

        closeReplaceModal: () =>
          set({
            isReplaceModalOpen: false,
            replaceModalData: null,
          }),

        confirmReplace: () => {
          const state = get();
          if (!state.replaceModalData) return;
          const { newSection } = state.replaceModalData;
          const result = get().replaceClassWithSection(newSection);
          if (result.success) {
            get().closeReplaceModal();
          }
        },

        setLoading: (loading) => set({ isLoading: loading }),

        setError: (message) => set({ errorMessage: message }),

        dismissWarning: (warningId) =>
          set((state) => ({
            warnings: state.warnings.filter((w) => w.id !== warningId),
          })),
      }),
      {
        name: "schedule-storage",
        partialize: (state) => ({
          scheduledClasses: state.scheduledClasses,
          allSections: state.allSections,
          allCourses: state.allCourses,
          schedules: state.schedules,
          currentScheduleId: state.currentScheduleId,
        }),
        onRehydrateStorage: () => (state) => {
          if (!state) return;

          // Loại bỏ các lớp LT mồ côi (chưa chọn TH bắt buộc) sau khi khôi phục từ localStorage
          const cleanSchedules = state.schedules.map((schedule) => {
            const cleanedClasses = schedule.scheduledClasses.filter((sc) => {
              const section = sc.classSection;
              if (section.isPractical) return true;

              const hasPractical = schedule.scheduledClasses.some(
                (other) =>
                  other.classSection.courseCode === section.courseCode &&
                  other.classSection.isPractical &&
                  other.classSection.classCode.startsWith(section.classCode + ".")
              );

              const allSections = state.allSections || [];
              const coursePracticals = allSections.filter((s) => s.courseCode === section.courseCode && s.isPractical);

              if (coursePracticals.length === 0) return true;
              return hasPractical;
            });

            return {
              ...schedule,
              scheduledClasses: cleanedClasses,
              totalCredits: getTotalCredits(cleanedClasses),
            };
          });

          const currentSchedule = cleanSchedules.find((s) => s.id === state.currentScheduleId);
          if (currentSchedule) {
            state.schedules = cleanSchedules;
            state.scheduledClasses = currentSchedule.scheduledClasses;
            state.totalCredits = currentSchedule.totalCredits;
          }
        },
      }
    ),
    { name: "ScheduleStore" }
  )
);

function inferFacultyFromCode(code: string): string | undefined {
  if (!code) return undefined;
  const prefix = code.substring(0, 2).toUpperCase();
  switch (prefix) {
    case "CS":
    case "AI":
    case "DS":
      return "KHMT";
    case "SE":
      return "CNPM";
    case "IS":
    case "EC":
      return "HTTT";
    case "CE":
      return "KTMT";
    case "NT":
      return "MMT&TT";
    case "IT":
      return "KTTT";
    case "EN":
      return "TTNN";
    case "MA":
    case "PH":
    case "PE":
      return "BMTL";
    default:
      return undefined;
  }
}

function isCohortMatch(sectionCohort: string | undefined, filterCohort: string): boolean {
  if (!filterCohort || filterCohort === "all") return true;
  if (!sectionCohort) return false;

  const sc = sectionCohort.trim().toLowerCase();
  const fc = filterCohort.trim().toLowerCase();

  if (sc === "0" || sc === "all" || sc === "*") return true;
  if (fc === "0" || fc === "all" || fc === "*") return true;
  if (sc === fc) return true;

  const scNum = parseInt(sc, 10);
  const fcNum = parseInt(fc, 10);
  if (!isNaN(scNum) && !isNaN(fcNum)) {
    if (scNum === fcNum) return true;
    if (scNum < 100 && fcNum > 2000 && fcNum % 100 === scNum) return true;
    if (fcNum < 100 && scNum > 2000 && scNum % 100 === fcNum) return true;
  }

  return sc.includes(fc) || fc.includes(sc);
}

function normalizeSearchText(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .trim();
}

/**
 * Hook Selector lọc danh sách môn học theo các tiêu chí tìm kiếm, khóa học, khoa quản lý và nhóm lớp.
 */
export function useFilteredCourses(): Course[] {
  const { allCourses, filterOptions, scheduledClasses } = useScheduleStore();

  return allCourses.filter((course) => {
    const hasNormalSections = course.sections.some(
      (s) => !s.classCode.includes(".ANTT") && !s.classCode.includes(".TTNT")
    );

    if (filterOptions.specialGroup === "none") {
      if (!hasNormalSections) return false;
    } else {
      if (!hasNormalSections && !course.sections.some((s) => s.classCode.includes(`.${filterOptions.specialGroup}`))) {
        return false;
      }
    }

    if (filterOptions.cohortFilter && filterOptions.cohortFilter !== "all") {
      const matchesCohort = course.sections.some((s) => isCohortMatch(s.cohort, filterOptions.cohortFilter!));
      if (!matchesCohort) return false;
    }

    if (filterOptions.facultyFilter && filterOptions.facultyFilter !== "all") {
      const selectedFaculty = filterOptions.facultyFilter.trim().toLowerCase();
      const matchesFaculty = course.sections.some((s) => {
        const fac = s.faculty || inferFacultyFromCode(s.courseCode);
        if (!fac) return false;
        return fac.trim().toLowerCase() === selectedFaculty;
      });
      if (!matchesFaculty) return false;
    }

    if (filterOptions.searchQuery) {
      const rawQuery = filterOptions.searchQuery.trim().toLowerCase();
      const normQuery = normalizeSearchText(rawQuery);

      const matchesName =
        course.courseName.toLowerCase().includes(rawQuery) ||
        normalizeSearchText(course.courseName).includes(normQuery);

      const matchesCourseCode =
        course.courseCode.toLowerCase().includes(rawQuery) ||
        normalizeSearchText(course.courseCode).includes(normQuery);

      const matchesLecturer = course.lecturers.some(
        (l) =>
          l.toLowerCase().includes(rawQuery) ||
          normalizeSearchText(l).includes(normQuery)
      );

      const matchesClassCode = course.sections.some(
        (s) =>
          s.classCode.toLowerCase().includes(rawQuery) ||
          normalizeSearchText(s.classCode).includes(normQuery)
      );

      if (!matchesName && !matchesCourseCode && !matchesLecturer && !matchesClassCode) {
        return false;
      }
    }

    if (filterOptions.lecturerFilter) {
      const hasLecturer = course.lecturers.some((l) =>
        l.toLowerCase().includes(filterOptions.lecturerFilter.toLowerCase())
      );
      if (!hasLecturer) return false;
    }

    if (filterOptions.showUnregisteredOnly) {
      const isRegistered = scheduledClasses.some((sc) => sc.classSection.courseCode === course.courseCode);
      if (isRegistered) return false;
    }

    if (filterOptions.classType === "theory" && !course.hasTheoryClass) return false;
    if (filterOptions.classType === "practical" && !course.hasPracticalClass) return false;

    return true;
  });
}

/**
 * Hook Selector kiểm tra môn học đã có lớp được xếp vào lịch hay chưa.
 */
export function useIsCourseRegistered(courseCode: string): boolean {
  const scheduledClasses = useScheduleStore((state) => state.scheduledClasses);
  return scheduledClasses.some((sc) => sc.classSection.courseCode === courseCode);
}

/**
 * Hook Selector lấy thông tin highlight cho một ô thời gian cụ thể trên lịch biểu.
 */
export function useSlotHighlight(dayOfWeek: number, period: number): HighlightedSlot | null {
  const highlightedSlots = useScheduleStore((state) => state.highlightedSlots);
  return highlightedSlots.find((slot) => slot.slot.dayOfWeek === dayOfWeek && slot.slot.period === period) || null;
}

