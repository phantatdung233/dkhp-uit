/**
 * Schedule Store
 * ==============
 * Zustand store quản lý toàn bộ state của ứng dụng
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type { ClassSection, Course, ScheduledClass, Conflict, FilterOptions, HighlightedSlot, Schedule } from "@/types";
import {
  checkConflictWithSchedule,
  checkMissingPairedClass,
  getHighlightedSlots,
  getTotalCredits,
  getPeriodArray,
} from "@/lib/schedule-utils";

interface ScheduleState {
  // ============ Data State ============
  /** Tất cả các ClassSection đã import */
  allSections: ClassSection[];

  /** Tất cả các Course đã group */
  allCourses: Course[];

  /** Danh sách các phương án thời khóa biểu */
  schedules: Schedule[];

  /** ID của phương án hiện tại */
  currentScheduleId: string;

  /** Danh sách lớp đã xếp vào lịch (của phương án hiện tại) */
  scheduledClasses: ScheduledClass[];

  /** Danh sách warnings (thiếu lớp TH/LT) */
  warnings: Conflict[];

  // ============ UI State ============
  // ... (giữ nguyên các UI state khác)
  highlightedSlots: HighlightedSlot[];
  filterOptions: FilterOptions;
  clickSelectedCourse: Course | null;
  clickSelectedLecturer: string | null;

  // State cho việc đang chọn lớp TH sau khi đã chọn LT
  pendingTheorySection: ClassSection | null;

  isClassSelectionModalOpen: boolean;
  classSelectionOptions: ClassSection[];
  pendingSlot: { dayOfWeek: number; period: number } | null;

  isLoading: boolean;
  errorMessage: string | null;

  // ============ Computed Values ============
  /** Tổng số tín chỉ đã đăng ký */
  totalCredits: number;

  // ============ Actions ============
  // Data actions
  setAllSections: (sections: ClassSection[]) => void;
  setAllCourses: (courses: Course[]) => void;
  importData: (sections: ClassSection[], courses: Course[]) => void;
  clearData: () => void;

  // Schedule actions
  addClassToSchedule: (
    section: ClassSection,
    skipPracticalPrompt?: boolean
  ) => { success: boolean; conflicts: Conflict[]; error?: string; pendingPractical?: boolean };
  removeClassFromSchedule: (classId: string) => void;
  clearSchedule: () => void;

  // Multi-schedule actions
  addSchedule: (name?: string) => void;
  removeSchedule: (id: string) => void;
  switchSchedule: (id: string) => void;
  renameSchedule: (id: string, name: string) => void;

  // UI Actions
  updateHighlightedSlots: () => void;
  setFilterOptions: (options: Partial<FilterOptions>) => void;
  resetFilters: () => void;
  setClickSelectedCourse: (course: Course | null) => void;
  setClickSelectedLecturer: (lecturer: string | null) => void;
  clearClickSelection: () => void;
  openClassSelectionModal: (options: ClassSection[], slot: { dayOfWeek: number; period: number }) => void;
  closeClassSelectionModal: () => void;
  selectClassFromModal: (section: ClassSection) => void;

  setLoading: (loading: boolean) => void;
  setError: (message: string | null) => void;
  dismissWarning: (warningId: string) => void;
}

export const useScheduleStore = create<ScheduleState>()(
  devtools(
    persist(
      (set, get) => ({
        // ============ Initial State ============
        allSections: [],
        allCourses: [],
        schedules: [
          {
            id: "default",
            name: "TKB 1",
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
          specialGroup: "none",
        },

        clickSelectedCourse: null,
        clickSelectedLecturer: null,

        pendingTheorySection: null,

        isClassSelectionModalOpen: false,
        classSelectionOptions: [],
        pendingSlot: null,

        isLoading: false,
        errorMessage: null,

        // ============ Data Actions ============
        setAllSections: (sections) => set({ allSections: sections }),

        setAllCourses: (courses) => set({ allCourses: courses }),

        importData: (sections, courses) =>
          set({
            allSections: sections,
            allCourses: courses,
            errorMessage: null,
          }),

        clearData: () =>
          set({
            allSections: [],
            allCourses: [],
            scheduledClasses: [],
            warnings: [],
            totalCredits: 0,
          }),

        // ============ Schedule Actions ============
        addClassToSchedule: (section, skipPracticalPrompt = false) => {
          const state = get();

          // Lấy các lớp đã đăng ký của môn này
          const registeredSections = state.scheduledClasses
            .filter((sc) => sc.classSection.courseCode === section.courseCode)
            .map((sc) => sc.classSection);

          // 1. Kiểm tra trùng loại (đã có LT thì không cho thêm LT khác, tương tự TH)
          const sameTypeClass = registeredSections.find((s) => s.isPractical === section.isPractical);
          if (sameTypeClass) {
            const typeStr = section.isPractical ? "THỰC HÀNH" : "LÝ THUYẾT";
            return {
              success: false,
              conflicts: [],
              error: `Bạn đã đăng ký lớp ${typeStr} cho môn "${section.courseName}" rồi!`,
            };
          }

          // 2. Kiểm tra tính hợp lệ giữa LT và TH (theo quy tắc mã lớp: TH phải bắt đầu bằng mã LT + ".")
          if (section.isPractical) {
            // Đang thêm lớp TH, kiểm tra xem có khớp với pending LT không
            const pendingTheory = state.pendingTheorySection;
            if (pendingTheory) {
              if (!section.classCode.startsWith(pendingTheory.classCode + ".")) {
                return {
                  success: false,
                  conflicts: [],
                  error: `Lớp thực hành "${section.classCode}" không khớp với lớp lý thuyết "${pendingTheory.classCode}" đã chọn!`,
                };
              }
            }
          }

          // 3. Kiểm tra conflict thời gian
          const conflicts = checkConflictWithSchedule(section, state.scheduledClasses);
          if (conflicts.length > 0) {
            return { success: false, conflicts };
          }

          // 4. Nếu đang thêm lớp LT và có lớp TH đi kèm → thêm LT và cho phép chọn TH sau
          if (!section.isPractical && !skipPracticalPrompt) {
            const practicalSections = state.allSections.filter(
              (s) =>
                s.courseCode === section.courseCode && s.isPractical && s.classCode.startsWith(section.classCode + ".")
            );

            if (practicalSections.length > 0) {
              // Thêm LT vào schedule trước
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

              // Cập nhật state và lưu pending để chọn TH
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

          // 5. Kiểm tra giới hạn tín chỉ (tối đa 30)
          const currentCredits = state.totalCredits;
          const courseAlreadyRegistered = registeredSections.length > 0 || state.pendingTheorySection !== null;
          // Nếu môn này chưa đăng ký bất kỳ lớp nào (LT hoặc TH), thì cộng thêm tín chỉ
          const addedCredits = courseAlreadyRegistered ? 0 : section.credits;

          if (currentCredits + addedCredits > 30) {
            return {
              success: false,
              conflicts: [],
              error: `Vượt quá giới hạn 30 tín chỉ! (Hiện tại: ${currentCredits} TC)`,
            };
          }

          // 6. Nếu đang thêm TH và có pending LT -> chỉ thêm TH (LT đã được thêm rồi)
          const pendingTheory = state.pendingTheorySection;
          let newScheduledClasses = [...state.scheduledClasses];

          // Thêm section hiện tại
          newScheduledClasses.push({
            id: `scheduled-${section.id}-${Date.now()}`,
            classSection: section,
            addedAt: new Date(),
          });

          // Kiểm tra warning về lớp thực hành/lý thuyết
          const missingWarning = checkMissingPairedClass(section, newScheduledClasses, state.allSections);

          const newWarnings = missingWarning
            ? [...state.warnings.filter((w) => w.id !== missingWarning.id), missingWarning]
            : state.warnings;

          // Cập nhật state
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
            // Clear click selection sau khi thêm thành công
            clickSelectedCourse: null,
            clickSelectedLecturer: null,
            pendingTheorySection: null,
            highlightedSlots: [],
          });

          return { success: true, conflicts: [] };
        },

        removeClassFromSchedule: (classId) => {
          const state = get();
          const removedClass = state.scheduledClasses.find((sc) => sc.id === classId);

          if (!removedClass) return;

          const removedSection = removedClass.classSection;

          // Tìm và xóa cả lớp đi kèm (LT xóa TH, TH xóa LT)
          let classIdsToRemove = [classId];

          if (removedSection.isPractical) {
            // Đang xóa TH, tìm LT đi kèm
            // Mã TH có dạng "LT_CODE.1", "LT_CODE.2", etc.
            const theoryClassCode = removedSection.classCode.split(".").slice(0, -1).join(".");
            const pairedTheory = state.scheduledClasses.find(
              (sc) =>
                sc.classSection.courseCode === removedSection.courseCode &&
                !sc.classSection.isPractical &&
                sc.classSection.classCode === theoryClassCode
            );
            if (pairedTheory) {
              classIdsToRemove.push(pairedTheory.id);
            }
          } else {
            // Đang xóa LT, tìm TH đi kèm
            const pairedPractical = state.scheduledClasses.find(
              (sc) =>
                sc.classSection.courseCode === removedSection.courseCode &&
                sc.classSection.isPractical &&
                sc.classSection.classCode.startsWith(removedSection.classCode + ".")
            );
            if (pairedPractical) {
              classIdsToRemove.push(pairedPractical.id);
            }
          }

          const newScheduledClasses = state.scheduledClasses.filter((sc) => !classIdsToRemove.includes(sc.id));

          // Cập nhật warnings - xóa warning liên quan đến các class bị xóa
          const removedSectionIds = state.scheduledClasses
            .filter((sc) => classIdsToRemove.includes(sc.id))
            .map((sc) => sc.classSection.id);

          const newWarnings = state.warnings.filter(
            (w) => !w.conflictingClasses.some((c) => removedSectionIds.includes(c.id))
          );

          // Nếu xóa lớp LT đang pending -> clear pending state
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

          // Cập nhật highlighted slots nếu đang có click selection
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
        },

        // ============ Multi-schedule Actions ============
        addSchedule: (name) => {
          const state = get();

          // Giới hạn tối đa 5 TKB
          if (state.schedules.length >= 5) {
            return;
          }

          const newId = Date.now().toString();
          const newSchedule: Schedule = {
            id: newId,
            name: name || `TKB ${state.schedules.length + 1}`,
            scheduledClasses: [],
            totalCredits: 0,
            warnings: [],
            createdAt: Date.now(),
          };

          set({
            schedules: [...state.schedules, newSchedule],
            currentScheduleId: newId,
            scheduledClasses: [],
            warnings: [],
            totalCredits: 0,
          });
        },

        removeSchedule: (id) => {
          const state = get();
          if (state.schedules.length <= 1) return; // Không cho xóa phương án cuối cùng

          const newSchedules = state.schedules.filter((s) => s.id !== id);

          // Nếu xóa phương án hiện tại, chuyển sang phương án đầu tiên
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
            // Clear selection khi chuyển phương án
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

        // ============ Selection Actions ============
        updateHighlightedSlots: () => {
          const state = get();

          // Helper function để lọc các section hợp lệ (không trùng loại, khớp mã LT-TH)
          const filterValidSections = (sections: ClassSection[]) => {
            return sections.filter((section) => {
              const registeredSections = state.scheduledClasses
                .filter((sc) => sc.classSection.courseCode === section.courseCode)
                .map((sc) => sc.classSection);

              // 1. Kiểm tra trùng loại
              const sameTypeClass = registeredSections.find((s) => s.isPractical === section.isPractical);
              if (sameTypeClass) return false;

              // 2. Kiểm tra tính hợp lệ giữa LT và TH
              if (section.isPractical) {
                // Nếu có pending LT, chỉ hiện TH khớp với pending LT
                if (state.pendingTheorySection) {
                  return section.classCode.startsWith(state.pendingTheorySection.classCode + ".");
                }
                const theoryClass = registeredSections.find((s) => !s.isPractical);
                if (theoryClass && !section.classCode.startsWith(theoryClass.classCode + ".")) {
                  return false;
                }
              } else {
                const practicalClass = registeredSections.find((s) => s.isPractical);
                if (practicalClass && !practicalClass.classCode.startsWith(section.classCode + ".")) {
                  return false;
                }
              }
              return true;
            });
          };

          // Nếu có pending theory section, chỉ hiện các lớp TH tương ứng
          if (state.pendingTheorySection) {
            const practicalSections = state.allSections.filter(
              (s) =>
                s.courseCode === state.pendingTheorySection!.courseCode &&
                s.isPractical &&
                s.classCode.startsWith(state.pendingTheorySection!.classCode + ".")
            );

            // Lọc theo nhóm đặc thù
            let filteredPracticals = practicalSections;
            const specialGroup = state.filterOptions.specialGroup;
            if (specialGroup === "none") {
              filteredPracticals = practicalSections.filter(
                (s) => !s.classCode.includes(".ANTT") && !s.classCode.includes(".TTNT")
              );
            } else {
              const groupTag = `.${specialGroup}`;
              const groupSections = practicalSections.filter((s) => s.classCode.includes(groupTag));
              if (groupSections.length > 0) {
                filteredPracticals = groupSections;
              } else {
                filteredPracticals = practicalSections.filter(
                  (s) => !s.classCode.includes(".ANTT") && !s.classCode.includes(".TTNT")
                );
              }
            }

            const highlighted = getHighlightedSlots(filteredPracticals, state.scheduledClasses, state.allSections);
            set({ highlightedSlots: highlighted });
            return;
          }

          // Nếu có click selected course, ưu tiên hiển thị
          if (state.clickSelectedCourse) {
            let filteredSections = state.clickSelectedLecturer
              ? state.clickSelectedCourse.sections.filter((s) => s.lecturer === state.clickSelectedLecturer)
              : state.clickSelectedCourse.sections;

            // Nếu đang chờ chọn lớp TH (sau khi đã chọn LT), chỉ hiện TH
            // Ngược lại, mặc định chỉ hiện lớp lý thuyết (nếu có)
            const hasTheorySections = filteredSections.some((s) => !s.isPractical);
            if (state.pendingTheorySection) {
              filteredSections = filteredSections.filter((s) => s.isPractical);
            } else if (hasTheorySections) {
              filteredSections = filteredSections.filter((s) => !s.isPractical);
            }

            // Lọc theo nhóm đặc thù và ưu tiên
            const specialGroup = state.filterOptions.specialGroup;
            if (specialGroup === "none") {
              // Mặc định: Chỉ hiện lớp thường (không có .ANTT hoặc .TTNT)
              filteredSections = filteredSections.filter(
                (s) => !s.classCode.includes(".ANTT") && !s.classCode.includes(".TTNT")
              );
            } else {
              const groupTag = `.${specialGroup}`;
              const groupSections = filteredSections.filter((s) => s.classCode.includes(groupTag));

              if (groupSections.length > 0) {
                // Nếu có lớp thuộc nhóm đặc thù, CHỈ hiển thị các lớp đó
                filteredSections = groupSections;
              } else {
                // Nếu không có bất kỳ lớp nào thuộc nhóm đặc thù, hiển thị lớp thường như bình thường
                filteredSections = filteredSections.filter(
                  (s) => !s.classCode.includes(".ANTT") && !s.classCode.includes(".TTNT")
                );
              }
            }

            // Lọc thêm theo quy tắc LT-TH
            filteredSections = filterValidSections(filteredSections);

            const highlighted = getHighlightedSlots(filteredSections, state.scheduledClasses, state.allSections);
            set({ highlightedSlots: highlighted });
            return;
          }

          set({ highlightedSlots: [] });
        },

        // ============ Filter Actions ============
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
              specialGroup: "none",
            },
          }),

        // ============ Click-to-place Actions ============
        setClickSelectedCourse: (course) => {
          set({
            clickSelectedCourse: course,
            clickSelectedLecturer: null,
          });
          // Cập nhật highlighted slots cho course được chọn
          get().updateHighlightedSlots();
        },

        setClickSelectedLecturer: (lecturer) => {
          set({ clickSelectedLecturer: lecturer });
          // Cập nhật highlighted slots theo giảng viên
          get().updateHighlightedSlots();
        },

        clearClickSelection: () => {
          set({
            clickSelectedCourse: null,
            clickSelectedLecturer: null,
            pendingTheorySection: null,
            highlightedSlots: [],
          });
        },

        // ============ Modal Actions ============
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

        // ============ UI Actions ============
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
          // Chỉ persist những state cần thiết
          scheduledClasses: state.scheduledClasses,
          allSections: state.allSections,
          allCourses: state.allCourses,
          schedules: state.schedules,
          currentScheduleId: state.currentScheduleId,
          // pendingTheorySection không persist vì là temporary state
        }),
        onRehydrateStorage: () => (state) => {
          if (!state) return;

          // Cleanup: Xóa các lớp LT không có lớp TH đi kèm (incomplete pairs)
          const cleanSchedules = state.schedules.map((schedule) => {
            const cleanedClasses = schedule.scheduledClasses.filter((sc) => {
              const section = sc.classSection;

              // Nếu là lớp TH, giữ lại
              if (section.isPractical) return true;

              // Nếu là lớp LT, kiểm tra xem có lớp TH đi kèm không
              const hasPractical = schedule.scheduledClasses.some(
                (other) =>
                  other.classSection.courseCode === section.courseCode &&
                  other.classSection.isPractical &&
                  other.classSection.classCode.startsWith(section.classCode + ".")
              );

              // Chỉ giữ lại lớp LT nếu môn này không có lớp TH, hoặc đã có lớp TH đi kèm
              const allSections = state.allSections || [];
              const coursePracticals = allSections.filter((s) => s.courseCode === section.courseCode && s.isPractical);

              // Nếu môn không có lớp TH thì giữ lại LT
              if (coursePracticals.length === 0) return true;

              // Nếu môn có lớp TH thì chỉ giữ LT khi đã có TH đi kèm
              return hasPractical;
            });

            return {
              ...schedule,
              scheduledClasses: cleanedClasses,
              totalCredits: getTotalCredits(cleanedClasses),
            };
          });

          // Cập nhật lại state với schedules đã clean
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

// ============ Selector Hooks ============

/**
 * Selector lấy danh sách courses đã filter
 */
export function useFilteredCourses(): Course[] {
  const { allCourses, filterOptions, scheduledClasses } = useScheduleStore();

  return allCourses.filter((course) => {
    // Filter by special group
    const hasNormalSections = course.sections.some(
      (s) => !s.classCode.includes(".ANTT") && !s.classCode.includes(".TTNT")
    );

    if (filterOptions.specialGroup === "none") {
      // Mặc định: Chỉ hiện môn nếu có ít nhất 1 lớp thường
      if (!hasNormalSections) return false;
    } else {
      // Nếu chọn nhóm (ANTT/TTNT): Hiện môn nếu có lớp thuộc nhóm đó HOẶC lớp thường
      // (Vì nếu không có lớp nhóm đó thì vẫn hiện lớp thường theo yêu cầu)
      if (!hasNormalSections && !course.sections.some((s) => s.classCode.includes(`.${filterOptions.specialGroup}`))) {
        return false;
      }
    }

    // Filter by search query (Name, Course Code, Lecturer, Class Code)
    if (filterOptions.searchQuery) {
      const query = filterOptions.searchQuery.toLowerCase();
      const matchesName = course.courseName.toLowerCase().includes(query);
      const matchesCourseCode = course.courseCode.toLowerCase().includes(query);
      const matchesLecturer = course.lecturers.some((l) => l.toLowerCase().includes(query));
      const matchesClassCode = course.sections.some((s) => s.classCode.toLowerCase().includes(query));

      if (!matchesName && !matchesCourseCode && !matchesLecturer && !matchesClassCode) return false;
    }

    // Filter by lecturer (vẫn giữ logic này để hỗ trợ các phần khác nếu cần)
    if (filterOptions.lecturerFilter) {
      const hasLecturer = course.lecturers.some((l) =>
        l.toLowerCase().includes(filterOptions.lecturerFilter.toLowerCase())
      );
      if (!hasLecturer) return false;
    }

    // Filter unregistered only
    if (filterOptions.showUnregisteredOnly) {
      const isRegistered = scheduledClasses.some((sc) => sc.classSection.courseCode === course.courseCode);
      if (isRegistered) return false;
    }

    // Filter by class type
    if (filterOptions.classType === "theory" && !course.hasTheoryClass) return false;
    if (filterOptions.classType === "practical" && !course.hasPracticalClass) return false;

    return true;
  });
}

/**
 * Selector kiểm tra một course đã đăng ký chưa
 */
export function useIsCourseRegistered(courseCode: string): boolean {
  const scheduledClasses = useScheduleStore((state) => state.scheduledClasses);
  return scheduledClasses.some((sc) => sc.classSection.courseCode === courseCode);
}

/**
 * Selector lấy slot highlight cho một cell cụ thể
 */
export function useSlotHighlight(dayOfWeek: number, period: number): HighlightedSlot | null {
  const highlightedSlots = useScheduleStore((state) => state.highlightedSlots);
  return highlightedSlots.find((slot) => slot.slot.dayOfWeek === dayOfWeek && slot.slot.period === period) || null;
}
