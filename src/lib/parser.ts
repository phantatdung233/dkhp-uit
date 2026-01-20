import * as XLSX from "xlsx";
import { parse, isValid } from "date-fns";
import type { ClassSection, Course, ParseResult, ParseError } from "@/types";

const REQUIRED_HEADERS = ["MÃ MH", "MÃ LỚP", "TÊN MÔN HỌC", "THỨ", "TIẾT"];
const HEADER_ALIASES: Record<string, string[]> = {
  courseCode: ["MÃ MH"],
  classCode: ["MÃ LỚP"],
  courseName: ["TÊN MÔN HỌC"],
  lecturerCode: ["MÃ GIẢNG VIÊN", "MÃ GV"],
  lecturer: ["TÊN GIẢNG VIÊN", "TÊN TRỢ GIẢNG"],
  maxStudents: ["SĨ SỐ"],
  credits: ["SỐ TC", "TC"],
  isPractical: ["THỰC HÀNH", "TH"],
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
      const s = parseRow(row, idx, isPracticalSheet);
      if (s) sections.push(s);
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

function parseRow(row: Record<string, unknown>, index: number, isPracticalSheet = false): ClassSection | null {
  const v = (k: keyof typeof UPPER_ALIASES) => getVal(row, k);
  const classCode = getString(v("classCode"));
  const courseName = getString(v("courseName"));
  if (!classCode && !courseName) return null;
  if (!classCode) throw new Error("Thiếu MÃ LỚP");
  if (!courseName) throw new Error("Thiếu TÊN MÔN HỌC");

  const courseCode = getString(v("courseCode")) || classCode.split(".")[0];
  const dayResult = parseDay(v("day"));
  const periodsResult = parsePeriods(v("periods"));
  if (!dayResult.isFlexible && dayResult.day === null) throw new Error("THỨ không hợp lệ");
  if (!periodsResult.isFlexible && !periodsResult.periods) throw new Error("TIẾT không hợp lệ");

  const periodStr = periodsResult.periods ?? "*";
  const { startPeriod, periodCount } = parsePeriodInfo(periodStr);
  const isPractical = parseBoolean(v("isPractical")) || isPracticalSheet;

  return {
    id: `${classCode}-${index}`,
    courseCode,
    classCode,
    courseName,
    lecturer: getString(v("lecturer")) || "Chưa có thông tin",
    lecturerCode: getString(v("lecturerCode")),
    credits: parseNumber(v("credits")) || 0,
    isPractical,
    dayOfWeek: dayResult.day,
    isFlexibleDay: dayResult.isFlexible,
    periods: periodStr,
    startPeriod,
    periodCount,
    isFlexiblePeriod: periodsResult.isFlexible,
    startDate: parseDate(v("startDate")),
    endDate: parseDate(v("endDate")),
    maxStudents: parseNumber(v("maxStudents")),
    room: getString(v("room")),
    weekType: parseNumber(v("weekType")),
    note: getString(v("note")),
    semester: parseNumber(v("semester")),
    academicYear: getString(v("academicYear")),
  };
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

/* ===== helpers (kept logic) ===== */

function getString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
}

function parseDay(value: unknown): { day: number | null; isFlexible: boolean } {
  const str = String(value).trim();
  if (str === "*") return { day: null, isFlexible: true };
  const day = Number(str);
  if (Number.isInteger(day)) return { day, isFlexible: false };
  return { day: null, isFlexible: false };
}

function parsePeriods(value: unknown): { periods: string | null; isFlexible: boolean } {
  const str = getString(value);
  if (!str) return { periods: null, isFlexible: false };
  if (str === "*") return { periods: "*", isFlexible: true };
  if (str.includes(","))
    return {
      periods: str
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .join(","),
      isFlexible: false,
    };
  if (/^\d+$/.test(str)) {
    return {
      periods: str
        .split("")
        .map((c) => (c === "0" ? "10" : c))
        .join(","),
      isFlexible: false,
    };
  }
  return { periods: str, isFlexible: false };
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
  const parsed = parse(s, "yyyy-MM-dd", new Date());
  if (isValid(parsed)) return parsed;
  const nativeD = new Date(s);
  return isValid(nativeD) ? nativeD : null;
}

export function validateParseResult(result: ParseResult): string[] {
  const warns: string[] = [];
  if (result.errorRows > 0) warns.push(`Có ${result.errorRows} dòng lỗi không được import`);
  if (result.sections.length === 0) warns.push("Không có dữ liệu lớp học nào được import");
  return warns;
}
