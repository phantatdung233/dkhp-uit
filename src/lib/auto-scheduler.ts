/**
 * Auto Scheduler Engine
 * ====================
 * Thuật toán tìm kiếm và xếp thời khóa biểu tự động dựa trên danh sách mã môn học.
 * Hỗ trợ ghép cặp Lý thuyết - Thực hành theo chuẩn UIT, kiểm tra xung đột thời gian,
 * gộp các phương án trùng khung giờ (cho phép chọn giảng viên), và xếp hạng theo tiêu chí.
 */

import type { ClassSection, Course } from "@/types";
import { checkConflict } from "@/lib/schedule-utils";

/**
 * Một OptionGroup đại diện cho 1 phương án chọn của 1 môn học.
 * - Nếu môn chỉ có LT: OptionGroup gồm các ClassSection của lớp LT đó.
 * - Nếu môn có cả LT và TH: OptionGroup gồm các ClassSection của lớp LT + các ClassSection của lớp TH tương ứng.
 */
export interface CourseOptionGroup {
  id: string;
  courseCode: string;
  theoryClassCode?: string;
  practicalClassCode?: string;
  theoryLecturer?: string;
  practicalLecturer?: string;
  sections: ClassSection[];
  lecturerSummary: string; // Tóm tắt tên giảng viên (LT + TH)
  dropdownLabel: string; // Định dạng "Lớp - Loại lớp - Giảng viên"
}

/**
 * Đại diện cho 1 môn học trong phương án TKB.
 * Chứa tất cả các OptionGroup có cùng khung thời gian (thứ + tiết) để người dùng chọn giảng viên.
 */
export interface CourseScheduleItem {
  courseCode: string;
  courseName: string;
  timePatternKey: string; // e.g. "LT: T2(1,2,3) | TH: T4(6,7,8)"
  availableOptions: CourseOptionGroup[];
  selectedOptionIndex: number;
}

export interface ScheduleSolution {
  id: string;
  courseItems: CourseScheduleItem[];
  sections: ClassSection[]; // Sections tính từ option đang được chọn của từng môn
  totalCredits: number;
  studyDays: number[]; // e.g. [2, 3, 5] (Thứ 2, 3, 5)
  dayCount: number;
  morningCount: number; // Tiết 1 - 5
  afternoonCount: number; // Tiết 6 - 10
  eveningCount: number; // Tiết 11 - 15
  hasSaturday: boolean;
  hasFlexibleClasses: boolean;
  score: number;
}

export interface AutoSchedulePreferences {
  timePreference: "all" | "morning" | "afternoon" | "compact_days";
  avoidSaturday: boolean;
  avoidEvening: boolean;
  maxDays?: number;
  preferredLecturers?: Record<string, string>; // courseCode -> lecturerName
}

/**
 * Tạo chữ ký thời gian cho danh sách sections (Thứ + Tiết của LT & TH).
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

/**
 * Tạo chuỗi tóm tắt tên giảng viên của một OptionGroup.
 */
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
 * Tạo danh sách các OptionGroups khả dĩ cho một môn học cụ thể.
 */
export function buildCourseOptionGroups(
  courseCode: string,
  allSections: ClassSection[],
  allCourses: Course[]
): CourseOptionGroup[] {
  // Tìm tất cả các sections thuộc mã môn này
  const courseSections = allSections.filter(
    (s) => s.courseCode.toLowerCase() === courseCode.toLowerCase()
  );

  if (courseSections.length === 0) return [];

  // Phân tách LT và TH
  const theorySections = courseSections.filter((s) => !s.isPractical);
  const practicalSections = courseSections.filter((s) => s.isPractical);

  // Gom các section theo classCode (vì 1 lớp có thể có nhiều section do học nhiều thứ)
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

  // TH 1: Môn có cả LT và TH
  if (theoryGroups.size > 0 && practicalGroups.size > 0) {
    for (const [tCode, tSecs] of theoryGroups.entries()) {
      // Tìm các lớp TH khớp mã: mã TH bắt đầu bằng mã LT + "." (ví dụ: IT001.N11 -> IT001.N11.1, IT001.N11.2)
      const matchingPracticals = Array.from(practicalGroups.entries()).filter(([pCode]) =>
        pCode.startsWith(tCode + ".")
      );

      if (matchingPracticals.length > 0) {
        for (const [pCode, pSecs] of matchingPracticals) {
          // Kiểm tra xem chính lớp LT và lớp TH này có bị xung đột giờ nhau không
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
        // Nếu không có lớp TH nào khớp mã LT này, cho phép chọn lớp LT đơn lẻ
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
    // TH 2: Môn chỉ có LT
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
    // TH 3: Môn chỉ có TH (hoặc đồ án)
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

/**
 * Kiểm tra xem một option group có xung đột với danh sách sections hiện tại không.
 */
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
 * Lấy các sections hiện tại của một Solution dựa trên selectedOptionIndex của từng CourseItem.
 */
export function getSolutionSections(courseItems: CourseScheduleItem[]): ClassSection[] {
  return courseItems.flatMap((item) => {
    const opt = item.availableOptions[item.selectedOptionIndex] || item.availableOptions[0];
    return opt ? opt.sections : [];
  });
}

/**
 * Helper: kiểm tra xem một lecturer name có khớp với preferred name không.
 * So sánh case-insensitive, hỗ trợ partial match (includes).
 */
function lecturerMatches(lecturerName: string | undefined | null, preferredName: string): boolean {
  if (!lecturerName) return false;
  const lec = lecturerName.trim().toLowerCase();
  const pref = preferredName.trim().toLowerCase();
  if (!lec || !pref) return false;
  return lec === pref || lec.includes(pref) || pref.includes(lec);
}

/**
 * Helper: kiểm tra xem một option group có chứa giảng viên khớp không.
 */
function optionMatchesLecturer(opt: CourseOptionGroup, preferredLecturer: string): boolean {
  return opt.sections.some((s) => lecturerMatches(s.lecturer, preferredLecturer));
}

/**
 * Tính toán số liệu thống kê và chấm điểm cho một phương án.
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

    // Đếm buổi học theo tiết
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

  // Tính điểm ưu tiên (Score càng cao càng tốt)
  let score = 100;

  // 1. Phạt nếu học nhiều ngày (càng ít ngày càng tốt)
  score -= dayCount * 10;

  // 2. Tiêu chí tránh thứ 7
  if (preferences.avoidSaturday && hasSaturday) {
    score -= 50;
  }

  // 3. Tiêu chí tránh ca tối
  if (preferences.avoidEvening && eveningCount > 0) {
    score -= eveningCount * 15;
  }

  // 4. Tiêu chí buổi học
  if (preferences.timePreference === "morning") {
    score += morningCount * 3 - afternoonCount * 3;
  } else if (preferences.timePreference === "afternoon") {
    score += afternoonCount * 3 - morningCount * 3;
  } else if (preferences.timePreference === "compact_days") {
    // FIX Bug 4: compact_days dùng primary sort theo dayCount ở ngoài,
    // scoring chỉ ảnh hưởng secondary sort → penalty nhẹ hơn
    score -= dayCount * 5;
  }

  // 5. Thưởng điểm nếu khớp giảng viên ưu tiên (dùng normalizedPreferred thay vì raw preferences)
  for (const item of courseItems) {
    const codeKey = item.courseCode.trim().toUpperCase();
    const preferred = normalizedPreferred[codeKey];

    if (preferred) {
      const currentOpt = item.availableOptions[item.selectedOptionIndex];

      // Kiểm tra xem option đang chọn có giảng viên này không
      const currentMatches = currentOpt && optionMatchesLecturer(currentOpt, preferred);

      if (currentMatches) {
        // Thưởng điểm lớn nhưng không lấn át primary sort (compact_days)
        score += 80;
      } else {
        // Kiểm tra xem có option nào trong available có GV này không
        const anyOptMatches = item.availableOptions.some((opt) =>
          optionMatchesLecturer(opt, preferred)
        );
        if (anyOptMatches) {
          // Có option GV đúng nhưng chưa được chọn → thưởng ít hơn
          score += 40;
        } else {
          // Khung giờ hoàn toàn không có GV mong muốn → phạt nhẹ
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
  /** Các môn đã fallback (bỏ qua filter GV vì kết hợp tiêu chí = 0 options) */
  lecturerFallbackCourses: string[];
  message: string;
}

/**
 * Thuật toán chính tự động tìm tất cả các phương án thời khóa biểu hợp lệ.
 * Các phương án cùng khung giờ (chỉ khác giảng viên) sẽ được gộp thành 1 phương án duy nhất.
 *
 * Logic filter:
 * - Hard filters (loại bỏ hẳn trước backtracking): avoidSaturday
 * - Soft filter (GV ưu tiên): Nếu GV + hard filters = 0 options → fallback bỏ qua GV,
 *   giữ lại hard filters, và ghi nhận để scoring ưu tiên phương án có GV đúng.
 */
export function generateAutoSchedules(
  courseCodes: string[],
  allSections: ClassSection[],
  allCourses: Course[],
  preferences: AutoSchedulePreferences,
  maxSolutions = 50
): AutoScheduleResult {
  // Chuẩn hóa và lọc danh sách mã môn duy nhất
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

  // Chuẩn hóa preferredLecturers thành key chữ hoa
  const normalizedPreferred: Record<string, string> = {};
  if (preferences.preferredLecturers) {
    for (const [k, v] of Object.entries(preferences.preferredLecturers)) {
      if (v && v !== "all") {
        normalizedPreferred[k.trim().toUpperCase()] = v.trim();
      }
    }
  }

  // Map thông tin môn học
  const courseMap = new Map<string, Course>();
  for (const c of allCourses) {
    courseMap.set(c.courseCode.toUpperCase(), c);
  }

  // ======================================================================
  // THU THẬP OPTIONS CHO TỪNG MÔN - Soft filter GV + Hard filter T7
  // ======================================================================
  const courseOptionsList: CourseOptionGroup[][] = [];
  const missingCourses: string[] = [];
  /** Các môn đã fallback bỏ qua GV ưu tiên (vì kết hợp tiêu chí = 0 options) */
  const lecturerFallbackCourses: string[] = [];

  for (const code of uniqueCodes) {
    const allOptions = buildCourseOptionGroups(code, allSections, allCourses);

    if (allOptions.length === 0) {
      missingCourses.push(code);
      continue;
    }

    const prefLecturer = normalizedPreferred[code];

    // Bước 1: Áp dụng HARD filter (avoidSaturday) – luôn loại bỏ
    let hardFiltered = allOptions;
    if (preferences.avoidSaturday) {
      hardFiltered = allOptions.filter(
        (opt) => !opt.sections.some((s) => s.dayOfWeek === 7)
      );
    }

    // Bước 2: Áp dụng SOFT filter (GV ưu tiên) trên kết quả hard filter
    let finalOptions: CourseOptionGroup[];

    if (prefLecturer && hardFiltered.length > 0) {
      // Thử kết hợp GV + hard filters
      const lecturerMatched = hardFiltered.filter((opt) =>
        optionMatchesLecturer(opt, prefLecturer)
      );

      if (lecturerMatched.length > 0) {
        // GV + hard filters OK → dùng kết quả đã lọc
        finalOptions = lecturerMatched;
      } else {
        // GV + hard filters = 0 → FALLBACK: bỏ qua GV, chỉ giữ hard filters
        // Ghi nhận để scoring ưu tiên phương án có GV đúng nếu có
        finalOptions = hardFiltered;
        lecturerFallbackCourses.push(
          `${code} (GV "${prefLecturer}" không có lớp thỏa các tiêu chí khác)`
        );
      }
    } else if (prefLecturer && hardFiltered.length === 0) {
      // Hard filter đã loại hết → thử chỉ GV filter trên allOptions
      const lecturerOnly = allOptions.filter((opt) =>
        optionMatchesLecturer(opt, prefLecturer)
      );

      if (lecturerOnly.length > 0) {
        // Có lớp GV nhưng bị hard filter loại → fallback dùng tất cả (bỏ cả 2 filter)
        // Điều này xảy ra khi GV chỉ dạy T7 mà user tick "Không học T7"
        finalOptions = allOptions;
        const filterNames: string[] = [];
        if (preferences.avoidSaturday) filterNames.push("Không học T7");
        lecturerFallbackCourses.push(
          `${code} (GV "${prefLecturer}" chỉ có lớp không thỏa tiêu chí "${filterNames.join(", ")}")`
        );
      } else {
        // Không có option nào cả (cả GV lẫn hard filter đều không match)
        finalOptions = [];
      }
    } else {
      // Không có GV ưu tiên → dùng hard filtered
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

  // ======================================================================
  // BACKTRACKING - Tìm kiếm phương án không trùng lịch
  // ======================================================================
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

  // ======================================================================
  // GỘP CÁC PHƯƠNG ÁN CÙNG KHUNG GIỜ (THỨ + TIẾT), CHỈ KHÁC GIẢNG VIÊN
  // ======================================================================
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

  // ======================================================================
  // XÂY DỰNG CÁC SCHEDULE SOLUTION - Auto-select GV ưu tiên
  // ======================================================================
  const consolidatedSolutions: ScheduleSolution[] = [];
  let solutionIndex = 0;

  // Xác định tập các courseCode hợp lệ (không nằm trong missingCourses)
  const validCourseCodes = uniqueCodes.filter(
    (code) => !missingCourses.some((m) => m.startsWith(code))
  );

  for (const [, { courseOptionMap, timePatternKeys }] of templateMap.entries()) {
    const courseItems: CourseScheduleItem[] = [];

    // Kiểm tra template có đủ tất cả các môn hợp lệ không
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

      // =================================================================
      // FIX Bug 3: Luôn tìm và auto-select option khớp GV ưu tiên
      // Sắp xếp availableOptions: GV ưu tiên lên đầu
      // =================================================================
      const prefLecturer = normalizedPreferred[code];
      let selectedOptionIndex = 0;

      if (prefLecturer) {
        // Sắp xếp: options khớp GV ưu tiên lên đầu mảng
        availableOptions.sort((a, b) => {
          const aMatch = optionMatchesLecturer(a, prefLecturer) ? 1 : 0;
          const bMatch = optionMatchesLecturer(b, prefLecturer) ? 1 : 0;
          return bMatch - aMatch; // GV match trước
        });
        // selectedOptionIndex = 0 luôn trỏ đúng option GV ưu tiên (nếu có)
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

  // ======================================================================
  // POST-FILTER: Chỉ filter hard criteria (T7, ca tối)
  // GV ưu tiên KHÔNG filter ở đây nữa (đã xử lý ở pre-filter + auto-select)
  // ======================================================================
  let filtered = consolidatedSolutions;

  // 1. Tiêu chí Không học Thứ 7: Loại bỏ phương án có lịch Thứ 7
  //    (Safety net: pre-filter đã lọc rồi nhưng consolidation có thể tạo ra)
  if (preferences.avoidSaturday) {
    filtered = filtered.filter((s) => !s.hasSaturday);
  }

  // 2. Tiêu chí Tránh ca tối
  if (preferences.avoidEvening) {
    filtered = filtered.filter((s) => s.eveningCount === 0);
  }

  // 3. GV ưu tiên: Thay vì loại bỏ, AUTO-CORRECT selectedOptionIndex
  //    Đảm bảo mỗi solution trỏ đúng option GV ưu tiên nếu có
  if (Object.keys(normalizedPreferred).length > 0) {
    for (const sol of filtered) {
      let needsUpdate = false;

      for (const item of sol.courseItems) {
        const pref = normalizedPreferred[item.courseCode.trim().toUpperCase()];
        if (!pref) continue;

        // Kiểm tra option hiện tại đã đúng GV chưa
        const currentOpt = item.availableOptions[item.selectedOptionIndex];
        if (currentOpt && optionMatchesLecturer(currentOpt, pref)) continue;

        // Tìm option khớp GV trong tất cả available options
        const correctIdx = item.availableOptions.findIndex((opt) =>
          optionMatchesLecturer(opt, pref)
        );

        if (correctIdx !== -1) {
          // Auto-correct: trỏ sang option đúng
          item.selectedOptionIndex = correctIdx;
          needsUpdate = true;
        }
        // Nếu không tìm thấy → giữ nguyên (trường hợp fallback, GV không có trong khung giờ này)
      }

      // Cập nhật lại sections sau khi auto-correct
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

  // ======================================================================
  // SẮP XẾP - Primary: compact_days (nếu chọn), Secondary: score
  // FIX Bug 4: compact_days sort primary theo dayCount, GV chỉ ảnh hưởng secondary
  // ======================================================================
  if (preferences.timePreference === "compact_days") {
    filtered.sort((a, b) => {
      // Primary: ít ngày hơn lên trước
      if (a.dayCount !== b.dayCount) {
        return a.dayCount - b.dayCount;
      }
      // Secondary: score cao hơn lên trước (GV ưu tiên nằm trong score)
      return b.score - a.score;
    });
  } else {
    filtered.sort((a, b) => b.score - a.score);
  }

  // Giới hạn số lượng trả về
  const topSolutions = filtered.slice(0, maxSolutions);

  // Tạo message kết quả
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
