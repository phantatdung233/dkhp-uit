import * as XLSX from "xlsx";
import { parse, isValid } from "date-fns";
import type { ClassSection, Course, ParseResult, ParseError } from "@/types";

/** Vị trí bắt đầu đọc dữ liệu trong file Excel UIT (Dòng 9 tương ứng index 8) */
const DATA_START_ROW = 8;

/** Chỉ số cột cố định (0-indexed) theo cấu trúc xuất bảng TKB của UIT */
const COL = {
  courseCode: 1,   // Cột B: Mã môn học
  classCode: 2,    // Cột C: Mã lớp
  courseName: 3,   // Cột D: Tên môn học
  lecturer: 5,     // Cột F: Tên giảng viên
  maxStudents: 6,  // Cột G: Sĩ số
  credits: 7,      // Cột H: Số tín chỉ
  day: 10,         // Cột K: Thứ
  periods: 11,     // Cột L: Tiết
  weekType: 12,    // Cột M: Cách mấy tuần
  room: 13,        // Cột N: Phòng học
  cohort: 14,      // Cột O: Khoá học
  faculty: 18,     // Cột S: Khoa quản lý
  startDate: 19,   // Cột T: Ngày bắt đầu
  endDate: 20,     // Cột U: Ngày kết thúc
} as const;

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
 * Trích xuất sĩ số tối đa từ định dạng "sĩ_số(đã_đk)" hoặc "sĩ_số".
 * Ví dụ: "40(0)" -> 40, "50" -> 50.
 */
function parseSiSo(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const str = getString(value);
  const match = str.match(/^(\d+)\s*\(\d+\)$/);
  if (match) return parseInt(match[1], 10);
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

function parsePeriods(value: unknown): { periods: string | null; isFlexible: boolean } {
  const str = getString(value);
  if (!str) return { periods: null, isFlexible: false };
  if (str === "*") return { periods: "*", isFlexible: true };
  if (str.includes(",")) {
    return {
      periods: str.split(",").map((s) => s.trim()).filter(Boolean).join(","),
      isFlexible: false,
    };
  }
  if (/^\d+$/.test(str)) {
    const nums = parseDigitPeriods(str);
    return { periods: nums.join(","), isFlexible: false };
  }
  return { periods: str, isFlexible: false };
}

/**
 * Tách chuỗi tiết học dạng số liền nhau.
 * Ví dụ: "123" -> [1, 2, 3], "121314" -> [12, 13, 14], "67890" -> [6, 7, 8, 9, 10].
 */
function parseDigitPeriods(str: string): number[] {
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
      const isConsecutive = twoDigit.every((v, i) => i === 0 || v === twoDigit[i - 1] + 1);
      if (isConsecutive) return twoDigit;
    }
  }
  return str.split("").map((ch) => (ch === "0" ? 10 : parseInt(ch, 10)));
}

function parseDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const utcDays = Math.floor(value) - 25569;
    const d = new Date(utcDays * 86400000);
    return isValid(d) ? d : null;
  }
  if (value instanceof Date && isValid(value)) return value;
  const s = getString(value);
  if (!s) return null;
  const parsed = parse(s, "yyyy-MM-dd", new Date());
  if (isValid(parsed)) return parsed;
  const parsedDmy = parse(s, "dd/MM/yyyy", new Date());
  if (isValid(parsedDmy)) return parsedDmy;
  const nativeD = new Date(s);
  return isValid(nativeD) ? nativeD : null;
}

function parsePeriodInfo(periods: string): { startPeriod: number; periodCount: number } {
  if (periods === "*") return { startPeriod: 0, periodCount: 0 };
  const nums = periods.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n) && n > 0);
  if (!nums.length) return { startPeriod: 0, periodCount: 0 };
  nums.sort((a, b) => a - b);
  return { startPeriod: nums[0], periodCount: nums.length };
}

/**
 * Đọc dữ liệu từ sheet theo vị trí cột cố định, bỏ qua các dòng tiêu đề trước dòng 9.
 */
function readSheetRows(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const aoa: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  const rows: Record<string, unknown>[] = [];

  for (let i = DATA_START_ROW; i < aoa.length; i++) {
    const rawRow = aoa[i];
    if (!rawRow || !Array.isArray(rawRow)) continue;

    const row: Record<string, unknown> = {
      courseCode: rawRow[COL.courseCode] ?? "",
      classCode: rawRow[COL.classCode] ?? "",
      courseName: rawRow[COL.courseName] ?? "",
      lecturer: rawRow[COL.lecturer] ?? "",
      maxStudents: rawRow[COL.maxStudents] ?? "",
      credits: rawRow[COL.credits] ?? "",
      day: rawRow[COL.day] ?? "",
      periods: rawRow[COL.periods] ?? "",
      weekType: rawRow[COL.weekType] ?? "",
      room: rawRow[COL.room] ?? "",
      cohort: rawRow[COL.cohort] ?? "",
      faculty: rawRow[COL.faculty] ?? "",
      startDate: rawRow[COL.startDate] ?? "",
      endDate: rawRow[COL.endDate] ?? "",
    };

    rows.push(row);
  }

  return rows;
}

/**
 * Phân tích cú pháp toàn bộ file Excel thời khóa biểu.
 * - Sheet 1: Thời khóa biểu Lý thuyết (TKB LT)
 * - Sheet 2: Thời khóa biểu Thực hành (TKB TH)
 */
export function parseWorkbook(workbook: XLSX.WorkBook): ParseResult {
  const allSections: ClassSection[] = [];
  const allErrors: ParseError[] = [];
  let totalRows = 0;

  const sheetsToProcess = workbook.SheetNames.slice(0, 2);

  for (let sheetIdx = 0; sheetIdx < sheetsToProcess.length; sheetIdx++) {
    const sheetName = sheetsToProcess[sheetIdx];
    const sheet = workbook.Sheets[sheetName];
    const isPracticalSheet = sheetIdx === 1;

    const rows = readSheetRows(sheet);
    if (!rows.length) continue;

    console.log(`Sheet "${sheetName}" (${isPracticalSheet ? "Thực hành" : "Lý thuyết"}): ${rows.length} dòng dữ liệu`);

    const res = parseRowsData(rows, isPracticalSheet);
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

/**
 * Phân tích dữ liệu từ đối tượng File (upload người dùng).
 */
export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "binary" });
        resolve(parseWorkbook(wb));
      } catch (err) {
        resolve(emptyResult(`Lỗi đọc file: ${err instanceof Error ? err.message : "Không xác định"}`));
      }
    };
    r.onerror = () => resolve(emptyResult("Không thể đọc file"));
    r.readAsBinaryString(file);
  });
}

/**
 * Tải và phân tích dữ liệu bảng tính từ liên kết Google Sheets.
 */
export async function parseGoogleSheet(url: string): Promise<ParseResult> {
  const response = await fetch("/api/fetch-sheet", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    let errorMsg = "Không thể tải dữ liệu từ Google Sheet";
    try {
      const data = await response.json();
      if (data?.error) {
        errorMsg = data.error;
      }
    } catch {
      // Giữ thông báo lỗi mặc định khi không parse được JSON
    }
    throw new Error(errorMsg);
  }

  const arrayBuffer = await response.arrayBuffer();
  try {
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    return parseWorkbook(wb);
  } catch (err) {
    throw new Error(`Lỗi phân tích dữ liệu bảng tính: ${err instanceof Error ? err.message : "Không đúng định dạng"}`);
  }
}

function parseRowsData(data: Record<string, unknown>[], isPracticalSheet = false): ParseResult {
  if (!data.length) return emptyResult("File không có dữ liệu");

  const sections: ClassSection[] = [];
  const errors: ParseError[] = [];

  data.forEach((row, idx) => {
    try {
      const parsed = parseRow(row, idx, isPracticalSheet);
      if (parsed) sections.push(...parsed);
    } catch (err) {
      errors.push({
        row: DATA_START_ROW + idx + 1,
        message: err instanceof Error ? err.message : "Lỗi không xác định",
        data: row,
      });
    }
  });

  return {
    success: errors.length === 0,
    sections,
    courses: groupSectionsToCourses(sections),
    totalRows: data.length,
    errorRows: errors.length,
    errors,
  };
}

/**
 * Phân tích cú pháp một dòng dữ liệu lớp học, hỗ trợ các lớp học nhiều buổi trong tuần.
 */
function parseRow(row: Record<string, unknown>, index: number, isPracticalSheet = false): ClassSection[] | null {
  const classCode = getString(row.classCode);
  const courseName = getString(row.courseName);
  if (!classCode && !courseName) return null;
  if (!classCode) throw new Error("Thiếu MÃ LỚP");
  if (!courseName) throw new Error("Thiếu TÊN MÔN HỌC");

  const courseCode = getString(row.courseCode) || classCode.split(".")[0];
  const isPractical = isPracticalSheet;

  const dayRaw = getString(row.day);
  const periodsRaw = getString(row.periods);

  // Xử lý môn không có lịch cố định (ĐA, KLTN, TTTN, HT2,...)
  if (!dayRaw && !periodsRaw) {
    return [buildSection(classCode, courseCode, courseName, row, index, isPractical, {
      dayOfWeek: null,
      isFlexibleDay: true,
      periods: "*",
      startPeriod: 0,
      periodCount: 0,
      isFlexiblePeriod: true,
    })];
  }

  // Xử lý lớp học nhiều ngày trong tuần (ví dụ: THỨ="3, 5", TIẾT="45, 123")
  if (dayRaw.includes(",")) {
    return parseMultiDayRow(classCode, courseCode, courseName, row, index, isPractical, dayRaw, periodsRaw);
  }

  const dayResult = parseDay(dayRaw);
  const periodsResult = parsePeriods(periodsRaw);

  if (dayResult.day === null && !dayResult.isFlexible) {
    return [buildSection(classCode, courseCode, courseName, row, index, isPractical, {
      dayOfWeek: null,
      isFlexibleDay: true,
      periods: periodsResult.periods ?? "*",
      startPeriod: 0,
      periodCount: 0,
      isFlexiblePeriod: true,
    })];
  }

  if (!periodsResult.isFlexible && !periodsResult.periods) {
    return [buildSection(classCode, courseCode, courseName, row, index, isPractical, {
      dayOfWeek: dayResult.day,
      isFlexibleDay: dayResult.isFlexible,
      periods: "*",
      startPeriod: 0,
      periodCount: 0,
      isFlexiblePeriod: true,
    })];
  }

  const periodStr = periodsResult.periods ?? "*";
  const { startPeriod, periodCount } = parsePeriodInfo(periodStr);

  return [buildSection(classCode, courseCode, courseName, row, index, isPractical, {
    dayOfWeek: dayResult.day,
    isFlexibleDay: dayResult.isFlexible,
    periods: periodStr,
    startPeriod,
    periodCount,
    isFlexiblePeriod: periodsResult.isFlexible,
  })];
}

function buildSection(
  classCode: string,
  courseCode: string,
  courseName: string,
  row: Record<string, unknown>,
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
    lecturer: getString(row.lecturer) || "Chưa có thông tin",
    lecturerCode: "",
    credits: parseNumber(row.credits) || 0,
    isPractical,
    dayOfWeek: schedule.dayOfWeek,
    isFlexibleDay: schedule.isFlexibleDay,
    periods: schedule.periods,
    startPeriod: schedule.startPeriod,
    periodCount: schedule.periodCount,
    isFlexiblePeriod: schedule.isFlexiblePeriod,
    startDate: parseDate(row.startDate),
    endDate: parseDate(row.endDate),
    maxStudents: parseSiSo(row.maxStudents),
    room: getString(row.room),
    weekType: parseNumber(row.weekType),
    note: "",
    semester: undefined,
    academicYear: "",
    cohort: getString(row.cohort),
    faculty: getString(row.faculty),
  };
}

function parseMultiDayRow(
  classCode: string,
  courseCode: string,
  courseName: string,
  row: Record<string, unknown>,
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

    sections.push(buildSection(classCode, courseCode, courseName, row, index, isPractical, {
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

function groupPeriodsForMultiDay(periodsRaw: string, numDays: number): number[][] {
  const parts = periodsRaw.split(/,\s+/);
  if (parts.length === numDays) {
    return parts.map((part) => parseDigitPeriods(part));
  }
  const allPeriods = parseDigitPeriods(periodsRaw);
  const perGroup = Math.ceil(allPeriods.length / numDays);
  const groups: number[][] = [];
  for (let i = 0; i < numDays; i++) {
    groups.push(allPeriods.slice(i * perGroup, (i + 1) * perGroup));
  }
  return groups;
}

/**
 * Gom nhóm danh sách ClassSection thành các đối tượng Course theo mã môn học.
 */
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
        cohorts: [],
        faculties: [],
      });
    }
    const c = map.get(key)!;
    c.sections.push(s);
    // Ưu tiên tên môn học từ lớp lý thuyết
    if (!s.isPractical && c.courseName.includes("(TH)")) {
      c.courseName = s.courseName;
    }
    if (s.isPractical) c.hasPracticalClass = true;
    else c.hasTheoryClass = true;
    if (s.lecturer && !c.lecturers.includes(s.lecturer)) c.lecturers.push(s.lecturer);
    if (s.cohort && !c.cohorts?.includes(s.cohort)) c.cohorts?.push(s.cohort);
    if (s.faculty && !c.faculties?.includes(s.faculty)) c.faculties?.push(s.faculty);
  }

  for (const c of map.values()) {
    const theoryCredits = Math.max(0, ...c.sections.filter((s) => !s.isPractical).map((s) => s.credits || 0));
    const practicalCredits = Math.max(0, ...c.sections.filter((s) => s.isPractical).map((s) => s.credits || 0));
    c.theoryCredits = theoryCredits;
    c.practicalCredits = practicalCredits;
    c.credits = theoryCredits + practicalCredits;
  }

  return Array.from(map.values());
}

/**
 * Kiểm tra và trả về danh sách cảnh báo từ kết quả phân tích file Excel.
 */
export function validateParseResult(result: ParseResult): string[] {
  const warns: string[] = [];
  if (result.errorRows > 0) warns.push(`Có ${result.errorRows} dòng lỗi không được import`);
  if (result.sections.length === 0) warns.push("Không có dữ liệu lớp học nào được import");
  return warns;
}

