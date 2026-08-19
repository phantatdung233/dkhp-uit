import * as XLSX from "xlsx";
import { parse, isValid } from "date-fns";
import type { ClassSection, Course, ParseResult, ParseError } from "@/types";

const REQUIRED_HEADERS = ["MÃ MH", "MÃ LỚP", "TÊN MÔN HỌC"];
const HEADER_ALIASES: Record<string, string[]> = {
  courseCode: ["MÃ MH"],
  classCode: ["MÃ LỚP"],
  courseName: ["TÊN MÔN HỌC"],
  lecturerCode: ["MÃ GIẢNG VIÊN", "MÃ GV"],
  lecturer: ["TÊN GIẢNG VIÊN", "TÊN TRỢ GIẢNG"],
  maxStudents: ["SĨ SỐ"],
  credits: ["SỐ TC", "TỐ TC", "TC"],
  isPractical: ["THỰC HÀNH", "TH"],
  htgd: ["HTGD"],
  day: ["THỨ"],
  periods: ["TIẾT"],
  room: ["PHÒNG HỌC"],
  weekType: ["CÁCH TUẦN"],
  semester: ["HỌC KỲ"],
  academicYear: ["NĂM HỌC"],
  startDate: ["NBD", "NGÀY BẮT ĐẦU"],
  endDate: ["NKT", "NGÀY KẾT THÚC"],
  note: ["GHI CHÚ", "GHICHU"],
};

/** HTGD values that represent flexible/hybrid schedules (e.g. HT1, HT2) */
const FLEXIBLE_HTGD_PATTERN = /^HT\d*$/i;

/** HTGD values that indicate no fixed schedule (Đồ án, KLTN, TTTN) */
const NO_SCHEDULE_HTGD = ["ĐA", "KLTN", "TTTN"];

// Precompute uppercase aliases for faster lookup
const UPPER_ALIASES: Record<string, string[]> = Object.fromEntries(
  Object.entries(HEADER_ALIASES).map(([k, arr]) => [k, arr.map((a) => a.toUpperCase())])
) as Record<string, string[]>;

function emptyResult(errMsg: string, totalRows = 0): ParseResult {
  return {
    success: false,
    sections: [],
    courses: [],
    totalRows,
    errorRows: 0,
    errors: [{ row: 0, message: errMsg }],
  };
}

export function parseWorkbook(workbook: XLSX.WorkBook): ParseResult {
  const allSections: ClassSection[] = [];
  const allErrors: ParseError[] = [];
  let totalRows = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", range: 7 });
    if (!json.length) continue;

    const isPracticalSheet = sheetName.toUpperCase().includes("TKB TH");
    const res = parseRawData(json, isPracticalSheet);

    allSections.push(...res.sections);
    allErrors.push(...res.errors.map((e) => ({ ...e, message: `[${sheetName}] ${e.message}` })));
    totalRows += res.totalRows;
  }

  const courses = groupSectionsToCourses(allSections);
  return {
    success: allErrors.length === 0,
    sections: allSections,
    courses,
    totalRows,
    errorRows: allErrors.length,
    errors: allErrors,
  };
}

export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "binary" });
        resolve(parseWorkbook(wb));
      } catch (err) {
        resolve(emptyResult(`Lỗi đọc file: ${err instanceof Error ? err.message : "Unknown error"}`));
      }
    };
    r.onerror = () => resolve(emptyResult("Không thể đọc file"));
    r.readAsBinaryString(file);
  });
}

function parseRawData(data: Record<string, unknown>[], isPracticalSheet = false): ParseResult {
  if (!data.length) return emptyResult("File không có dữ liệu");

  // Normalize keys to UPPERCASE once
  const normalized = data.map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k.trim().toUpperCase(), v]))
  );

  const headers = Object.keys(normalized[0] || {});
  const missing = REQUIRED_HEADERS.filter((req) => !headers.some((h) => h.includes(req)));
  if (missing.length) {
    return emptyResult(`Thiếu các cột bắt buộc: ${missing.join(", ")}`, normalized.length);
  }

  const sections: ClassSection[] = [];
  const errors: ParseError[] = [];

  normalized.forEach((row, idx) => {
    try {
      const parsed = parseRow(row, idx, isPracticalSheet);
      if (parsed) sections.push(...parsed);
    } catch (err) {
      errors.push({
        row: idx + 2,
        message: err instanceof Error ? err.message : "Unknown error",
        data: row,
      });
    }
  });

  return {
    success: errors.length === 0,
    sections,
    courses: groupSectionsToCourses(sections),
    totalRows: normalized.length,
    errorRows: errors.length,
    errors,
  };
}

function getVal(row: Record<string, unknown>, aliasKey: keyof typeof UPPER_ALIASES): unknown {
  const aliases = UPPER_ALIASES[aliasKey];
  // exact match
  for (const a of aliases) if (row[a] !== undefined) return row[a];
  // contains match (avoid TH vs THỨ confusion)
  const keys = Object.keys(row);
  for (const a of aliases) {
    const found = keys.find((k) => k.includes(a) && !(a === "TH" && k === "THỨ"));
    if (found) return row[found];
  }
  return undefined;
}

/**
 * Parse a single row. May return multiple ClassSections for multi-day schedules.
 * Returns null (as empty array) for empty rows.
 */
function parseRow(row: Record<string, unknown>, index: number, isPracticalSheet = false): ClassSection[] | null {
  const v = (k: keyof typeof UPPER_ALIASES) => getVal(row, k);
  const classCode = getString(v("classCode"));
  const courseName = getString(v("courseName"));
  if (!classCode && !courseName) return null;
  if (!classCode) throw new Error("Thiếu MÃ LỚP");
  if (!courseName) throw new Error("Thiếu TÊN MÔN HỌC");

  const courseCode = getString(v("courseCode")) || classCode.split(".")[0];
  const isPractical = parseBoolean(v("isPractical")) || isPracticalSheet;
  const htgd = getString(v("htgd")).toUpperCase();

  // Parse THỨ and TIẾT with HTGD awareness
  const dayRaw = getString(v("day"));
  const periodsRaw = getString(v("periods"));

  // Determine if this is a flexible/no-schedule class based on HTGD
  const isFlexibleHTGD = FLEXIBLE_HTGD_PATTERN.test(htgd);
  const isNoScheduleHTGD = NO_SCHEDULE_HTGD.includes(htgd);

  // Handle case when both THỨ and TIẾT are empty
  if (!dayRaw && !periodsRaw) {
    if (isFlexibleHTGD || isNoScheduleHTGD || !htgd) {
      // This is a flexible/no-schedule class (ĐA, KLTN, TTTN, HT2, etc.)
      return [buildSection(classCode, courseCode, courseName, row, v, index, isPractical, {
        dayOfWeek: null,
        isFlexibleDay: true,
        periods: "*",
        startPeriod: 0,
        periodCount: 0,
        isFlexiblePeriod: true,
      })];
    }
    throw new Error("THỨ và TIẾT trống");
  }

  // Check for multi-day schedule: THỨ="3, 5", TIẾT="45, 123"
  if (dayRaw.includes(",")) {
    return parseMultiDayRow(classCode, courseCode, courseName, row, v, index, isPractical, dayRaw, periodsRaw);
  }

  // Single day parsing
  const dayResult = parseDay(dayRaw);
  const periodsResult = parsePeriods(periodsRaw);

  // If THỨ is empty but TIẾT has value (or vice versa), check HTGD
  if (dayResult.day === null && !dayResult.isFlexible) {
    if (isFlexibleHTGD) {
      // Flexible schedule like HT2 — THỨ empty is ok
      return [buildSection(classCode, courseCode, courseName, row, v, index, isPractical, {
        dayOfWeek: null,
        isFlexibleDay: true,
        periods: periodsResult.periods ?? "*",
        startPeriod: 0,
        periodCount: 0,
        isFlexiblePeriod: true,
      })];
    }
    throw new Error("THỨ không hợp lệ");
  }

  if (!periodsResult.isFlexible && !periodsResult.periods) {
    if (isFlexibleHTGD) {
      return [buildSection(classCode, courseCode, courseName, row, v, index, isPractical, {
        dayOfWeek: dayResult.day,
        isFlexibleDay: dayResult.isFlexible,
        periods: "*",
        startPeriod: 0,
        periodCount: 0,
        isFlexiblePeriod: true,
      })];
    }
    throw new Error("TIẾT không hợp lệ");
  }

  const periodStr = periodsResult.periods ?? "*";
  const { startPeriod, periodCount } = parsePeriodInfo(periodStr);

  return [buildSection(classCode, courseCode, courseName, row, v, index, isPractical, {
    dayOfWeek: dayResult.day,
    isFlexibleDay: dayResult.isFlexible,
    periods: periodStr,
    startPeriod,
    periodCount,
    isFlexiblePeriod: periodsResult.isFlexible,
  })];
}

/**
 * Build a ClassSection with common fields + schedule-specific fields.
 */
function buildSection(
  classCode: string,
  courseCode: string,
  courseName: string,
  row: Record<string, unknown>,
  v: (k: keyof typeof UPPER_ALIASES) => unknown,
  index: number,
  isPractical: boolean,
  schedule: {
    dayOfWeek: number | null;
    isFlexibleDay: boolean;
    periods: string;
    startPeriod: number;
    periodCount: number;
    isFlexiblePeriod: boolean;
  },
  idSuffix = ""
): ClassSection {
  return {
    id: `${classCode}-${index}${idSuffix}`,
    courseCode,
    classCode,
    courseName,
    lecturer: getString(v("lecturer")) || "Chưa có thông tin",
    lecturerCode: getString(v("lecturerCode")),
    credits: parseNumber(v("credits")) || 0,
    isPractical,
    dayOfWeek: schedule.dayOfWeek,
    isFlexibleDay: schedule.isFlexibleDay,
    periods: schedule.periods,
    startPeriod: schedule.startPeriod,
    periodCount: schedule.periodCount,
    isFlexiblePeriod: schedule.isFlexiblePeriod,
    startDate: parseDate(v("startDate")),
    endDate: parseDate(v("endDate")),
    maxStudents: parseSiSo(v("maxStudents")),
    room: getString(v("room")),
    weekType: parseNumber(v("weekType")),
    note: getString(v("note")),
    semester: parseNumber(v("semester")),
    academicYear: getString(v("academicYear")),
  };
}

/**
 * Parse a multi-day row into multiple ClassSections.
 *
 * Example: THỨ="3, 5", TIẾT="45, 123"
 *   → Section 1: day=3, periods="4,5"
 *   → Section 2: day=5, periods="1,2,3"
 */
function parseMultiDayRow(
  classCode: string,
  courseCode: string,
  courseName: string,
  row: Record<string, unknown>,
  v: (k: keyof typeof UPPER_ALIASES) => unknown,
  index: number,
  isPractical: boolean,
  dayRaw: string,
  periodsRaw: string
): ClassSection[] {
  const dayParts = dayRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const periodGroups = groupPeriodsForMultiDay(periodsRaw, dayParts.length);

  const sections: ClassSection[] = [];

  for (let i = 0; i < dayParts.length; i++) {
    const day = Number(dayParts[i]);
    if (!Number.isInteger(day)) continue;

    const periods = periodGroups[i] || [];
    if (periods.length === 0) continue;

    const periodStr = periods.join(",");
    const sorted = [...periods].sort((a, b) => a - b);

    sections.push(buildSection(classCode, courseCode, courseName, row, v, index, isPractical, {
      dayOfWeek: day,
      isFlexibleDay: false,
      periods: periodStr,
      startPeriod: sorted[0],
      periodCount: sorted.length,
      isFlexiblePeriod: false,
    }, `-d${day}`));
  }

  return sections;
}

/**
 * Group TIẾT string for multi-day schedules.
 *
 * Input: periodsRaw="45, 123", numDays=2
 * Output: [[4,5], [1,2,3]]
 *
 * Strategy: Split by ", " (with space) first, then parse each part.
 */
function groupPeriodsForMultiDay(periodsRaw: string, numDays: number): number[][] {
  // Split by ", " (comma+space) to separate day groups
  const parts = periodsRaw.split(/,\s+/);

  if (parts.length === numDays) {
    return parts.map((part) => parseDigitPeriods(part));
  }

  // Fallback: parse all and split evenly
  const allPeriods = parseDigitPeriods(periodsRaw);
  const perGroup = Math.ceil(allPeriods.length / numDays);
  const groups: number[][] = [];
  for (let i = 0; i < numDays; i++) {
    groups.push(allPeriods.slice(i * perGroup, (i + 1) * perGroup));
  }
  return groups;
}

function parsePeriodInfo(periods: string): { startPeriod: number; periodCount: number } {
  if (periods === "*") return { startPeriod: 0, periodCount: 0 };
  const nums = periods
    .split(",")
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n) && n > 0);
  if (!nums.length) return { startPeriod: 0, periodCount: 0 };
  nums.sort((a, b) => a - b);
  return { startPeriod: nums[0], periodCount: nums.length };
}

function groupSectionsToCourses(sections: ClassSection[]): Course[] {
  const map = new Map<string, Course>();
  for (const s of sections) {
    const key = s.courseCode;
    if (!map.has(key)) {
      map.set(key, {
        id: s.courseCode,
        courseCode: s.courseCode,
        courseName: s.courseName,
        credits: 0,
        hasPracticalClass: false,
        hasTheoryClass: false,
        sections: [],
        lecturers: [],
      });
    }
    const c = map.get(key)!;
    c.sections.push(s);
    // Ưu tiên lấy tên môn từ lớp lý thuyết (thường không có hậu tố TH)
    if (!s.isPractical && c.courseName.includes("(TH)")) {
      c.courseName = s.courseName;
    }
    if (s.isPractical) c.hasPracticalClass = true;
    else c.hasTheoryClass = true;
    if (s.lecturer && !c.lecturers.includes(s.lecturer)) c.lecturers.push(s.lecturer);
  }

  // Cập nhật số tín chỉ tổng của môn = Max(LT) + Max(TH)
  // Cách tính này bao quát được cả trường hợp split credits (2+1=3)
  // và trường hợp chỉ có LT (3+0=3) hoặc chỉ có TH (0+3=3)
  for (const c of map.values()) {
    const theoryCredits = Math.max(0, ...c.sections.filter((s) => !s.isPractical).map((s) => s.credits || 0));
    const practicalCredits = Math.max(0, ...c.sections.filter((s) => s.isPractical).map((s) => s.credits || 0));
    c.theoryCredits = theoryCredits;
    c.practicalCredits = practicalCredits;
    c.credits = theoryCredits + practicalCredits;
  }

  return Array.from(map.values());
}

/* ===== helpers ===== */

function getString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
}

/**
 * Parse SĨ SỐ format: "40(0)" → 40, "10(5)" → 10, "100" → 100
 * Extracts just the capacity (max students), ignoring registered count.
 */
function parseSiSo(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const str = getString(value);
  // Match "40(0)" or "100(23)" format
  const match = str.match(/^(\d+)\s*\(\d+\)$/);
  if (match) return parseInt(match[1], 10);
  // Plain number
  const n = Number(str);
  return isNaN(n) ? undefined : n;
}

function parseDay(value: unknown): { day: number | null; isFlexible: boolean } {
  const str = getString(value);
  if (!str) return { day: null, isFlexible: false };
  if (str === "*") return { day: null, isFlexible: true };
  const day = Number(str);
  if (Number.isInteger(day)) return { day, isFlexible: false };
  return { day: null, isFlexible: false };
}

/**
 * Parse TIẾT column value into a normalized comma-separated string.
 *
 * Handles:
 *   - "123"      → "1,2,3"
 *   - "678"      → "6,7,8"
 *   - "67890"    → "6,7,8,9,10"    (0 → 10)
 *   - "12345"    → "1,2,3,4,5"
 *   - "121314"   → "12,13,14"       (2-digit periods for tối)
 *   - "11121314" → "11,12,13,14"
 *   - "1,2,3"    → "1,2,3"          (already comma-separated)
 *   - ""         → null
 *   - "*"        → "*" (flexible)
 */
function parsePeriods(value: unknown): { periods: string | null; isFlexible: boolean } {
  const str = getString(value);
  if (!str) return { periods: null, isFlexible: false };
  if (str === "*") return { periods: "*", isFlexible: true };
  // Already comma-separated
  if (str.includes(",")) {
    return {
      periods: str
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .join(","),
      isFlexible: false,
    };
  }
  // Pure digit string — use smart parsing
  if (/^\d+$/.test(str)) {
    const nums = parseDigitPeriods(str);
    return {
      periods: nums.join(","),
      isFlexible: false,
    };
  }
  return { periods: str, isFlexible: false };
}

/**
 * Smart parser for continuous digit period strings.
 *
 * Strategy:
 *   1. Check if the string can be evenly split into 2-digit numbers that are all ≥10 and ≤15
 *      AND form a consecutive sequence (e.g., "121314" → [12,13,14])
 *   2. Otherwise, parse character-by-character where '0' = 10
 *      (e.g., "12345" → [1,2,3,4,5], "67890" → [6,7,8,9,10])
 */
function parseDigitPeriods(str: string): number[] {
  // Try 2-digit parsing first if string length is even and ≥ 2
  if (str.length >= 2 && str.length % 2 === 0) {
    const twoDigit: number[] = [];
    let valid = true;
    for (let i = 0; i < str.length; i += 2) {
      const num = parseInt(str.substring(i, i + 2), 10);
      if (num >= 10 && num <= 15) {
        twoDigit.push(num);
      } else {
        valid = false;
        break;
      }
    }
    if (valid && twoDigit.length > 0) {
      // Verify it's a reasonable sequence (consecutive)
      const isConsecutive = twoDigit.every((v, i) => i === 0 || v === twoDigit[i - 1] + 1);
      if (isConsecutive) {
        return twoDigit;
      }
    }
  }

  // Character-by-character parsing: '0' → 10
  return str.split("").map((ch) => (ch === "0" ? 10 : parseInt(ch, 10)));
}

function parseBoolean(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  return getString(value).toLowerCase() === "1";
}

function parseDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && isValid(value)) return value;
  const s = getString(value);
  if (!s) return null;
  // Try ISO format first: "2026-09-07"
  const parsed = parse(s, "yyyy-MM-dd", new Date());
  if (isValid(parsed)) return parsed;
  // Try dd/MM/yyyy format
  const parsedDmy = parse(s, "dd/MM/yyyy", new Date());
  if (isValid(parsedDmy)) return parsedDmy;
  const nativeD = new Date(s);
  return isValid(nativeD) ? nativeD : null;
}

export function validateParseResult(result: ParseResult): string[] {
  const warns: string[] = [];
  if (result.errorRows > 0) warns.push(`Có ${result.errorRows} dòng lỗi không được import`);
  if (result.sections.length === 0) warns.push("Không có dữ liệu lớp học nào được import");
  return warns;
}
