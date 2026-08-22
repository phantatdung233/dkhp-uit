/**
 * Thuật toán tìm kiếm và xếp thời khóa biểu tự động (Auto-Scheduler Engine).
 * Hỗ trợ ghép cặp LT-TH theo quy chuẩn UIT, kiểm tra xung đột thời gian,
 * gộp các phương án cùng khung giờ và chấm điểm theo tiêu chí người dùng.
 */

import type { ClassSection, Course } from "@/types";
import { checkConflict } from "@/lib/schedule-utils";

/**
 * Đại diện cho một phương án đăng ký của một môn học.
 * - Môn chỉ có LT: Gồm các section của lớp LT đó.
 * - Môn có cả LT và TH: Gồm các section của lớp LT và lớp TH tương ứng.
 */
export interface CourseOptionGroup {
  id: string;
  courseCode: string;
  theoryClassCode?: string;
  practicalClassCode?: string;
  theoryLecturer?: string;
  practicalLecturer?: string;
  sections: ClassSection[];
  lecturerSummary: string;
  dropdownLabel: string;
}

/**
 * Đại diện cho một môn học trong phương án TKB.
 * Chứa danh sách các OptionGroup có cùng khung giờ (Thứ + Tiết) để người dùng linh hoạt chọn giảng viên.
 */
export interface CourseScheduleItem {
  courseCode: string;
  courseName: string;
  timePatternKey: string;
  availableOptions: CourseOptionGroup[];
  selectedOptionIndex: number;
}

/**
 * Thông tin chi tiết một phương án thời khóa biểu hoàn chỉnh.
 */
export interface ScheduleSolution {
  id: string;
  courseItems: CourseScheduleItem[];
  sections: ClassSection[];
  totalCredits: number;
  studyDays: number[];
  dayCount: number;
  morningCount: number;
  afternoonCount: number;
  eveningCount: number;
  hasSaturday: boolean;
  hasFlexibleClasses: boolean;
  score: number;
}

/**
 * Tùy chọn ưu tiên khi tự động sắp xếp TKB.
 */
export interface AutoSchedulePreferences {
  timePreference: "all" | "morning" | "afternoon" | "compact_days";
  avoidSaturday: boolean;
  avoidEvening: boolean;
  maxDays?: number;
  preferredLecturers?: Record<string, string>;
}

/**
 * Tạo chuỗi định danh chữ ký thời gian từ danh sách section (ví dụ: "LT:T2(1,2,3) | TH:T4(6,7,8)").
 */
export function getOptionTimeSignature(sections: ClassSection[]): string {
  return sections
    .map((s) => {
      const type = s.isPractical ? "TH" : "LT";
      const day = s.dayOfWeek !== null ? `T${s.dayOfWeek}` : "*";
      const periods = s.periods || "*";
      return `${type}:${day}(${periods})`;
    })
    .sort()
    .join(" | ");
}

function buildLecturerSummary(theorySecs: ClassSection[], practicalSecs: ClassSection[]): string {
  const tLecturer = theorySecs[0]?.lecturer;
  const pLecturer = practicalSecs[0]?.lecturer;

  if (tLecturer && pLecturer) {
    if (tLecturer === pLecturer) {
      return tLecturer;
    }
    return `LT: ${tLecturer} • TH: ${pLecturer}`;
  }
  return tLecturer || pLecturer || "Chưa có thông tin";
}

/**
 * Tạo danh sách các cặp hoặc nhóm lớp học phần hợp lệ cho một môn học cụ thể.
 * Tự động ghép nối lớp LT và lớp TH theo quy tắc mã lớp của UIT (Mã TH bắt đầu bằng Mã LT + ".").
 */
export function buildCourseOptionGroups(
  courseCode: string,
  allSections: ClassSection[],
  allCourses: Course[]
): CourseOptionGroup[] {
  const courseSections = allSections.filter(
    (s) => s.courseCode.toLowerCase() === courseCode.toLowerCase()
  );

  if (courseSections.length === 0) return [];

  const theorySections = courseSections.filter((s) => !s.isPractical);
  const practicalSections = courseSections.filter((s) => s.isPractical);

  // Gom các section theo classCode để xử lý môn học nhiều buổi trong tuần
  const theoryGroups = new Map<string, ClassSection[]>();
  for (const s of theorySections) {
    if (!theoryGroups.has(s.classCode)) {
      theoryGroups.set(s.classCode, []);
    }
    theoryGroups.get(s.classCode)!.push(s);
  }

  const practicalGroups = new Map<string, ClassSection[]>();
  for (const s of practicalSections) {
    if (!practicalGroups.has(s.classCode)) {
      practicalGroups.set(s.classCode, []);
    }
    practicalGroups.get(s.classCode)!.push(s);
  }

  const options: CourseOptionGroup[] = [];
  let optIndex = 0;

  // Trường hợp 1: Môn có cả lớp Lý thuyết và Thực hành
  if (theoryGroups.size > 0 && practicalGroups.size > 0) {
    for (const [tCode, tSecs] of theoryGroups.entries()) {
      const matchingPracticals = Array.from(practicalGroups.entries()).filter(([pCode]) =>
        pCode.startsWith(tCode + ".")
      );

      if (matchingPracticals.length > 0) {
        for (const [pCode, pSecs] of matchingPracticals) {
          // Kiểm tra xem chính lớp LT và lớp TH này có bị xung đột thời gian không
          let internalConflict = false;
          for (const ts of tSecs) {
            for (const ps of pSecs) {
              if (checkConflict(ts, ps)) {
                internalConflict = true;
                break;
              }
            }
            if (internalConflict) break;
          }

          if (!internalConflict) {
            const tLec = tSecs[0]?.lecturer || "Chưa có thông tin";
            const pLec = pSecs[0]?.lecturer || "Chưa có thông tin";
            const dropdownLabel =
              tLec === pLec
                ? `${tCode} & ${pCode} : ${tLec}`
                : `${tCode} & ${pCode} : ${tLec} - ${pLec}`;

            options.push({
              id: `opt-${courseCode}-${optIndex++}`,
              courseCode,
              theoryClassCode: tCode,
              practicalClassCode: pCode,
              theoryLecturer: tLec,
              practicalLecturer: pLec,
              sections: [...tSecs, ...pSecs],
              lecturerSummary: buildLecturerSummary(tSecs, pSecs),
              dropdownLabel,
            });
          }
        }
      } else {
        // Dự phòng khi không tìm thấy lớp TH khớp tiền tố mã LT
        const tLec = tSecs[0]?.lecturer || "Chưa có thông tin";
        options.push({
          id: `opt-${courseCode}-${optIndex++}`,
          courseCode,
          theoryClassCode: tCode,
          theoryLecturer: tLec,
          sections: [...tSecs],
          lecturerSummary: buildLecturerSummary(tSecs, []),
          dropdownLabel: `${tCode} - Lý thuyết - ${tLec}`,
        });
      }
    }
  } else if (theoryGroups.size > 0) {
    // Trường hợp 2: Môn chỉ có Lý thuyết
    for (const [tCode, tSecs] of theoryGroups.entries()) {
      const tLec = tSecs[0]?.lecturer || "Chưa có thông tin";
      options.push({
        id: `opt-${courseCode}-${optIndex++}`,
        courseCode,
        theoryClassCode: tCode,
        theoryLecturer: tLec,
        sections: [...tSecs],
        lecturerSummary: buildLecturerSummary(tSecs, []),
        dropdownLabel: `${tCode} - Lý thuyết - ${tLec}`,
      });
    }
  } else if (practicalGroups.size > 0) {
    // Trường hợp 3: Môn chỉ có Thực hành hoặc Đồ án
    for (const [pCode, pSecs] of practicalGroups.entries()) {
      const pLec = pSecs[0]?.lecturer || "Chưa có thông tin";
      options.push({
        id: `opt-${courseCode}-${optIndex++}`,
        courseCode,
        practicalClassCode: pCode,
        practicalLecturer: pLec,
        sections: [...pSecs],
        lecturerSummary: buildLecturerSummary([], pSecs),
        dropdownLabel: `${pCode} - Thực hành - ${pLec}`,
      });
    }
  }

  return options;
}

function hasConflictWithAccumulated(
  newOptionSections: ClassSection[],
  accumulatedSections: ClassSection[]
): boolean {
  for (const newSec of newOptionSections) {
    for (const accSec of accumulatedSections) {
      if (checkConflict(newSec, accSec)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Trích xuất danh sách các ClassSection từ phương án TKB dựa theo tùy chọn giảng viên đang được chọn.
 */
export function getSolutionSections(courseItems: CourseScheduleItem[]): ClassSection[] {
  return courseItems.flatMap((item) => {
    const opt = item.availableOptions[item.selectedOptionIndex] || item.availableOptions[0];
    return opt ? opt.sections : [];
  });
}

function lecturerMatches(lecturerName: string | undefined | null, preferredName: string): boolean {
  if (!lecturerName) return false;
  const lec = lecturerName.trim().toLowerCase();
  const pref = preferredName.trim().toLowerCase();
  if (!lec || !pref) return false;
  return lec === pref || lec.includes(pref) || pref.includes(lec);
}

function optionMatchesLecturer(opt: CourseOptionGroup, preferredLecturer: string): boolean {
  return opt.sections.some((s) => lecturerMatches(s.lecturer, preferredLecturer));
}

/**
 * Tính toán số liệu thống kê và chấm điểm độ phù hợp cho từng phương án TKB.
 */
function analyzeSolution(
  courseItems: CourseScheduleItem[],
  preferences: AutoSchedulePreferences,
  normalizedPreferred: Record<string, string>,
  index: number
): ScheduleSolution {
  const sections = getSolutionSections(courseItems);

  const daysSet = new Set<number>();
  let morningCount = 0;
  let afternoonCount = 0;
  let eveningCount = 0;
  let hasSaturday = false;
  let hasFlexible = false;
  let totalCredits = 0;

  for (const s of sections) {
    if (s.dayOfWeek !== null) {
      daysSet.add(s.dayOfWeek);
      if (s.dayOfWeek === 7) hasSaturday = true;
    } else {
      hasFlexible = true;
    }

    if (s.periods && s.periods !== "*") {
      const pNums = s.periods
        .split(",")
        .map((p) => parseInt(p.trim(), 10))
        .filter((n) => !isNaN(n));

      for (const p of pNums) {
        if (p >= 1 && p <= 5) morningCount++;
        else if (p >= 6 && p <= 10) afternoonCount++;
        else if (p >= 11 && p <= 15) eveningCount++;
      }
    }

    totalCredits += s.credits || 0;
  }

  const studyDays = Array.from(daysSet).sort((a, b) => a - b);
  const dayCount = studyDays.length;

  let score = 100;

  // Ưu tiên lịch học ít ngày hơn
  score -= dayCount * 10;

  if (preferences.avoidSaturday && hasSaturday) {
    score -= 50;
  }

  if (preferences.avoidEvening && eveningCount > 0) {
    score -= eveningCount * 15;
  }

  if (preferences.timePreference === "morning") {
    score += morningCount * 3 - afternoonCount * 3;
  } else if (preferences.timePreference === "afternoon") {
    score += afternoonCount * 3 - morningCount * 3;
  } else if (preferences.timePreference === "compact_days") {
    score -= dayCount * 5;
  }

  // Thưởng điểm cho các môn có giảng viên trùng khớp với ưu tiên
  for (const item of courseItems) {
    const codeKey = item.courseCode.trim().toUpperCase();
    const preferred = normalizedPreferred[codeKey];

    if (preferred) {
      const currentOpt = item.availableOptions[item.selectedOptionIndex];
      const currentMatches = currentOpt && optionMatchesLecturer(currentOpt, preferred);

      if (currentMatches) {
        score += 80;
      } else {
        const anyOptMatches = item.availableOptions.some((opt) =>
          optionMatchesLecturer(opt, preferred)
        );
        if (anyOptMatches) {
          score += 40;
        } else {
          score -= 20;
        }
      }
    }
  }

  return {
    id: `solution-${Date.now()}-${index}`,
    courseItems,
    sections,
    totalCredits,
    studyDays,
    dayCount,
    morningCount,
    afternoonCount,
    eveningCount,
    hasSaturday,
    hasFlexibleClasses: hasFlexible,
    score,
  };
}

export interface AutoScheduleResult {
  success: boolean;
  solutions: ScheduleSolution[];
  totalFound: number;
  selectedCoursesCount: number;
  missingCourses: string[];
  lecturerFallbackCourses: string[];
  message: string;
}

/**
 * Thuật toán sinh tự động các phương án thời khóa biểu không trùng lịch.
 * Sử dụng Backtracking tìm kiếm và gộp các phương án có cùng khung giờ để tối ưu lựa chọn giảng viên.
 */
export function generateAutoSchedules(
  courseCodes: string[],
  allSections: ClassSection[],
  allCourses: Course[],
  preferences: AutoSchedulePreferences,
  maxSolutions = 50
): AutoScheduleResult {
  const uniqueCodes = Array.from(
    new Set(
      courseCodes
        .map((c) => c.trim().toUpperCase())
        .filter((c) => c.length > 0)
    )
  );

  if (uniqueCodes.length === 0) {
    return {
      success: false,
      solutions: [],
      totalFound: 0,
      selectedCoursesCount: 0,
      missingCourses: [],
      lecturerFallbackCourses: [],
      message: "Vui lòng nhập ít nhất 1 mã môn học.",
    };
  }

  const normalizedPreferred: Record<string, string> = {};
  if (preferences.preferredLecturers) {
    for (const [k, v] of Object.entries(preferences.preferredLecturers)) {
      if (v && v !== "all") {
        normalizedPreferred[k.trim().toUpperCase()] = v.trim();
      }
    }
  }

  const courseMap = new Map<string, Course>();
  for (const c of allCourses) {
    courseMap.set(c.courseCode.toUpperCase(), c);
  }

  const courseOptionsList: CourseOptionGroup[][] = [];
  const missingCourses: string[] = [];
  const lecturerFallbackCourses: string[] = [];

  for (const code of uniqueCodes) {
    const allOptions = buildCourseOptionGroups(code, allSections, allCourses);

    if (allOptions.length === 0) {
      missingCourses.push(code);
      continue;
    }

    const prefLecturer = normalizedPreferred[code];

    // Lọc cứng: Loại bỏ các lớp thứ 7 nếu được yêu cầu
    let hardFiltered = allOptions;
    if (preferences.avoidSaturday) {
      hardFiltered = allOptions.filter(
        (opt) => !opt.sections.some((s) => s.dayOfWeek === 7)
      );
    }

    // Lọc mềm: Thử lọc giảng viên ưu tiên, tự động fallback nếu không còn lựa chọn nào
    let finalOptions: CourseOptionGroup[];

    if (prefLecturer && hardFiltered.length > 0) {
      const lecturerMatched = hardFiltered.filter((opt) =>
        optionMatchesLecturer(opt, prefLecturer)
      );

      if (lecturerMatched.length > 0) {
        finalOptions = lecturerMatched;
      } else {
        finalOptions = hardFiltered;
        lecturerFallbackCourses.push(
          `${code} (GV "${prefLecturer}" không có lớp thỏa các tiêu chí khác)`
        );
      }
    } else if (prefLecturer && hardFiltered.length === 0) {
      const lecturerOnly = allOptions.filter((opt) =>
        optionMatchesLecturer(opt, prefLecturer)
      );

      if (lecturerOnly.length > 0) {
        finalOptions = allOptions;
        const filterNames: string[] = [];
        if (preferences.avoidSaturday) filterNames.push("Không học T7");
        lecturerFallbackCourses.push(
          `${code} (GV "${prefLecturer}" chỉ có lớp không thỏa tiêu chí "${filterNames.join(", ")}")`
        );
      } else {
        finalOptions = [];
      }
    } else {
      finalOptions = hardFiltered;
    }

    if (finalOptions.length === 0) {
      const reasons: string[] = [];
      if (prefLecturer) reasons.push(`GV: ${prefLecturer}`);
      if (preferences.avoidSaturday) reasons.push("Không học Thứ 7");
      missingCourses.push(
        reasons.length > 0 ? `${code} (không có lớp thỏa: ${reasons.join(" + ")})` : code
      );
    } else {
      courseOptionsList.push(finalOptions);
    }
  }

  if (missingCourses.length > 0 && courseOptionsList.length === 0) {
    return {
      success: false,
      solutions: [],
      totalFound: 0,
      selectedCoursesCount: uniqueCodes.length,
      missingCourses,
      lecturerFallbackCourses,
      message: `Không tìm thấy lớp học phần phù hợp cho: ${missingCourses.join(", ")}. Hãy thử bỏ bớt tiêu chí (GV hoặc Không học T7).`,
    };
  }

  // Thuật toán quay lui (Backtracking) tìm các tổ hợp không xung đột
  const rawSolutions: CourseOptionGroup[][] = [];

  function backtrack(courseIndex: number, currentChosen: CourseOptionGroup[], currentSections: ClassSection[]) {
    if (rawSolutions.length >= 600) return;

    if (courseIndex === courseOptionsList.length) {
      rawSolutions.push([...currentChosen]);
      return;
    }

    const currentCourseOptions = courseOptionsList[courseIndex];

    for (const option of currentCourseOptions) {
      if (!hasConflictWithAccumulated(option.sections, currentSections)) {
        backtrack(
          courseIndex + 1,
          [...currentChosen, option],
          [...currentSections, ...option.sections]
        );
      }
    }
  }

  backtrack(0, [], []);

  if (rawSolutions.length === 0) {
    const activeFilters: string[] = [];
    if (Object.keys(normalizedPreferred).length > 0) activeFilters.push("Giảng viên ưu tiên");
    if (preferences.avoidSaturday) activeFilters.push("Không học Thứ 7");

    return {
      success: false,
      solutions: [],
      totalFound: 0,
      selectedCoursesCount: uniqueCodes.length,
      missingCourses,
      lecturerFallbackCourses,
      message:
        missingCourses.length > 0
          ? `Không tìm thấy phương án TKB nào không bị trùng lịch. Không tìm thấy lớp phù hợp cho: ${missingCourses.join(", ")}`
          : activeFilters.length > 0
            ? `Không tìm thấy phương án TKB nào không bị trùng lịch với tiêu chí: ${activeFilters.join(", ")}. Hãy thử bỏ bớt tiêu chí.`
            : "Không tìm thấy phương án TKB nào không bị trùng lịch. Hãy thử bỏ bớt môn học.",
    };
  }

  // Gom các phương án có cùng khung giờ (chỉ khác giảng viên)
  const templateMap = new Map<
    string,
    {
      courseOptionMap: Map<string, Map<string, CourseOptionGroup>>;
      timePatternKeys: Map<string, string>;
    }
  >();

  for (const solutionGroups of rawSolutions) {
    const signatureParts: string[] = [];
    const timePatternKeys = new Map<string, string>();

    for (const group of solutionGroups) {
      const timeSig = getOptionTimeSignature(group.sections);
      timePatternKeys.set(group.courseCode, timeSig);
      signatureParts.push(`${group.courseCode}:${timeSig}`);
    }

    const fullSignature = signatureParts.sort().join("___");

    if (!templateMap.has(fullSignature)) {
      templateMap.set(fullSignature, {
        courseOptionMap: new Map(),
        timePatternKeys,
      });
    }

    const entry = templateMap.get(fullSignature)!;

    for (const group of solutionGroups) {
      if (!entry.courseOptionMap.has(group.courseCode)) {
        entry.courseOptionMap.set(group.courseCode, new Map());
      }
      const optMap = entry.courseOptionMap.get(group.courseCode)!;
      const key = `${group.theoryClassCode || ""}-${group.practicalClassCode || ""}-${group.lecturerSummary}`;
      if (!optMap.has(key)) {
        optMap.set(key, group);
      }
    }
  }

  const consolidatedSolutions: ScheduleSolution[] = [];
  let solutionIndex = 0;

  const validCourseCodes = uniqueCodes.filter(
    (code) => !missingCourses.some((m) => m.startsWith(code))
  );

  for (const [, { courseOptionMap, timePatternKeys }] of templateMap.entries()) {
    const courseItems: CourseScheduleItem[] = [];

    let hasAllCourses = true;
    for (const code of validCourseCodes) {
      const optMap = courseOptionMap.get(code);
      if (!optMap || optMap.size === 0) {
        hasAllCourses = false;
        break;
      }
    }
    if (!hasAllCourses) continue;

    for (const code of validCourseCodes) {
      const optMap = courseOptionMap.get(code);
      if (!optMap || optMap.size === 0) continue;

      const availableOptions = Array.from(optMap.values());
      const courseInfo = courseMap.get(code);
      const timeKey = timePatternKeys.get(code) || "";

      // Ưu tiên đưa phương án có giảng viên mong muốn lên đầu danh sách chọn
      const prefLecturer = normalizedPreferred[code];
      let selectedOptionIndex = 0;

      if (prefLecturer) {
        availableOptions.sort((a, b) => {
          const aMatch = optionMatchesLecturer(a, prefLecturer) ? 1 : 0;
          const bMatch = optionMatchesLecturer(b, prefLecturer) ? 1 : 0;
          return bMatch - aMatch;
        });
      }

      courseItems.push({
        courseCode: code,
        courseName: courseInfo?.courseName || code,
        timePatternKey: timeKey,
        availableOptions,
        selectedOptionIndex,
      });
    }

    if (courseItems.length === 0) continue;

    const analyzed = analyzeSolution(courseItems, preferences, normalizedPreferred, solutionIndex++);
    consolidatedSolutions.push(analyzed);
  }

  let filtered = consolidatedSolutions;

  if (preferences.avoidSaturday) {
    filtered = filtered.filter((s) => !s.hasSaturday);
  }

  if (preferences.avoidEvening) {
    filtered = filtered.filter((s) => s.eveningCount === 0);
  }

  // Tự động điều chỉnh lựa chọn giảng viên trong phương án theo ưu tiên
  if (Object.keys(normalizedPreferred).length > 0) {
    for (const sol of filtered) {
      let needsUpdate = false;

      for (const item of sol.courseItems) {
        const pref = normalizedPreferred[item.courseCode.trim().toUpperCase()];
        if (!pref) continue;

        const currentOpt = item.availableOptions[item.selectedOptionIndex];
        if (currentOpt && optionMatchesLecturer(currentOpt, pref)) continue;

        const correctIdx = item.availableOptions.findIndex((opt) =>
          optionMatchesLecturer(opt, pref)
        );

        if (correctIdx !== -1) {
          item.selectedOptionIndex = correctIdx;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        sol.sections = getSolutionSections(sol.courseItems);
      }
    }
  }

  if (filtered.length === 0) {
    const activeFilters: string[] = [];
    if (preferences.avoidSaturday) activeFilters.push("Không học Thứ 7");
    if (preferences.avoidEvening) activeFilters.push("Tránh ca tối");
    if (Object.keys(normalizedPreferred).length > 0) activeFilters.push("Giảng viên ưu tiên");

    return {
      success: false,
      solutions: [],
      totalFound: 0,
      selectedCoursesCount: uniqueCodes.length,
      missingCourses,
      lecturerFallbackCourses,
      message:
        activeFilters.length > 0
          ? `Không tìm thấy phương án TKB nào thỏa mãn đồng thời: ${activeFilters.join(", ")}. Hãy thử bỏ bớt tiêu chí.`
          : "Không tìm thấy phương án TKB phù hợp. Hãy thử bỏ bớt tiêu chí.",
    };
  }

  // Sắp xếp các phương án: Nếu chọn 'compact_days', ưu tiên ít ngày học trước
  if (preferences.timePreference === "compact_days") {
    filtered.sort((a, b) => {
      if (a.dayCount !== b.dayCount) {
        return a.dayCount - b.dayCount;
      }
      return b.score - a.score;
    });
  } else {
    filtered.sort((a, b) => b.score - a.score);
  }

  const topSolutions = filtered.slice(0, maxSolutions);

  let message = `Tìm thấy ${filtered.length} phương án khung giờ TKB hợp lệ!`;
  if (lecturerFallbackCourses.length > 0) {
    message += ` (Lưu ý: ${lecturerFallbackCourses.length} môn không thể áp dụng GV ưu tiên)`;
  }
  if (missingCourses.length > 0) {
    message += ` (${missingCourses.length} môn bị bỏ qua)`;
  }

  return {
    success: true,
    solutions: topSolutions,
    totalFound: filtered.length,
    selectedCoursesCount: uniqueCodes.length - missingCourses.length,
    missingCourses,
    lecturerFallbackCourses,
    message,
  };
}

