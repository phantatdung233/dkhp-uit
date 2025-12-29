/**
 * Excel Parser Utility
 * ====================
 * Xử lý việc parse file Excel (.xlsx)
 * thành dữ liệu ClassSection và Course
 */

import * as XLSX from "xlsx";
import { parse, isValid } from "date-fns";
import type { ClassSection, Course, ParseResult, ParseError } from "@/types";

/**
 * Danh sách các header được yêu cầu trong file Excel
 */
const REQUIRED_HEADERS = ["MÃ", "LỚP", "TÊN MÔN", "THỨ", "TIẾT"];

/**
 * Mapping các từ khóa header sang key nội bộ
 */
const HEADER_ALIASES: Record<string, string[]> = {
  courseCode: ["MÃ MH", "MÃ MÔN", "MÃ HỌC PHẦN", "MÃ HP"],
  classCode: ["MÃ LỚP", "LỚP HỌC PHẦN"],
  courseName: ["TÊN MÔN", "TÊN HỌC PHẦN", "TÊN MH"],
  day: ["THỨ"],
  periods: ["TIẾT"],
  lecturer: ["TÊN GIẢNG VIÊN", "TÊN TRỢ GIẢNG", "TÊN GV"],
  lecturerCode: ["MÃ GIẢNG VIÊN", "MÃ GV"],
  credits: ["SỐ TC", "TÍN CHỈ", "STC", "SỐ TÍN CHỈ", "TC"],
  isPractical: ["THỰC HÀNH", "TH"],
  startDate: ["NBD", "NGÀY BẮT ĐẦU"],
  endDate: ["NKT", "NGÀY KẾT THÚC"],
  room: ["PHÒNG", "PHÒNG HỌC"],
  maxStudents: ["SĨ SỐ", "SL"],
  weekType: ["CÁCH TUẦN"],
  note: ["GHI CHÚ", "GHICHU"],
  semester: ["HỌC KỲ", "HỌC KÌ"],
  academicYear: ["NĂM HỌC"],
};

/**
 * Tìm hàng chứa header trong worksheet
 * @param worksheet - XLSX worksheet
 * @returns Index của hàng header (0-based)
 */
function findHeaderRow(worksheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
  const maxRowToCheck = Math.min(range.e.r, 20); // Quét tối đa 20 hàng đầu

  for (let row = 0; row <= maxRowToCheck; row++) {
    const rowData: string[] = [];

    // Đọc 15 cột đầu của hàng này
    for (let col = 0; col <= 14; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      if (cell && cell.v) {
        rowData.push(String(cell.v).trim().toUpperCase());
      }
    }

    // Kiểm tra xem hàng này có chứa đủ các header bắt buộc không
    const hasAllHeaders = REQUIRED_HEADERS.every((header) => rowData.some((cellValue) => cellValue.includes(header)));

    if (hasAllHeaders) {
      return row;
    }
  }

  // Nếu không tìm thấy, mặc định là hàng 0
  return 0;
}

/**
 * Parse một XLSX Workbook thành dữ liệu ứng dụng
 * @param workbook - XLSX workbook object
 * @returns ParseResult
 */
export function parseWorkbook(workbook: XLSX.WorkBook): ParseResult {
  const allSections: ClassSection[] = [];
  const allErrors: ParseError[] = [];
  let totalRows = 0;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];

    // Tìm header row tự động (quét tối đa 20 dòng đầu)
    const headerRowIndex = findHeaderRow(worksheet);

    // Kiểm tra xem sheet này có header hợp lệ không
    if (headerRowIndex === 0) {
      // Double check xem có phải sheet có dữ liệu không
      const testData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: "",
        range: 0,
      });
      if (testData.length === 0) continue;

      const firstRow = testData[0];
      const headers = Object.keys(firstRow);
      const hasSomeHeaders = REQUIRED_HEADERS.some((h) => headers.includes(h));
      if (!hasSomeHeaders) continue; // Bỏ qua sheet không có header TKB
    }

    // Convert sang JSON với header
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: "", // Giá trị mặc định cho cell trống
      range: headerRowIndex, // Bắt đầu từ hàng header tìm được
    });

    if (jsonData.length === 0) continue;

    // Xác định isPractical dựa trên tên sheet
    // "TKB TH", "Thực hành", "TH" -> isPractical = true
    const sheetNameUpper = sheetName.toUpperCase();
    const isPracticalSheet =
      sheetNameUpper.includes("TH") ||
      sheetNameUpper.includes("THỰC HÀNH") ||
      sheetNameUpper.includes("THUC HANH") ||
      sheetNameUpper.includes("PRACTICAL");

    const result = parseRawData(jsonData, isPracticalSheet);

    allSections.push(...result.sections);
    allErrors.push(
      ...result.errors.map((err) => ({
        ...err,
        message: `[${sheetName}] ${err.message}`,
      }))
    );
    totalRows += result.totalRows;
  }

  // Group sections thành courses
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
 * Parse file Excel thành dữ liệu ứng dụng
 * @param file - File Excel được upload
 * @returns ParseResult chứa danh sách ClassSection và Course
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        resolve(parseWorkbook(workbook));
      } catch (error) {
        resolve({
          success: false,
          sections: [],
          courses: [],
          totalRows: 0,
          errorRows: 0,
          errors: [
            {
              row: 0,
              message: `Lỗi đọc file: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        sections: [],
        courses: [],
        totalRows: 0,
        errorRows: 0,
        errors: [
          {
            row: 0,
            message: "Không thể đọc file",
          },
        ],
      });
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * Parse raw JSON data từ Excel/CSV thành ClassSection và Course
 * @param data - Array of objects từ sheet
 * @param isPracticalSheet - True nếu sheet này là sheet thực hành
 * @returns ParseResult
 */
function parseRawData(data: Record<string, unknown>[], isPracticalSheet: boolean = false): ParseResult {
  // Chuẩn hóa keys của data (viết hoa, trim) để tránh lỗi lệch header
  const normalizedData = data.map((row) => {
    const newRow: Record<string, unknown> = {};
    Object.keys(row).forEach((key) => {
      const normalizedKey = key.trim().toUpperCase();
      newRow[normalizedKey] = row[key];
    });
    return newRow;
  });

  const sections: ClassSection[] = [];
  const errors: ParseError[] = [];

  if (normalizedData.length === 0) {
    return {
      success: false,
      sections: [],
      courses: [],
      totalRows: 0,
      errorRows: 0,
      errors: [
        {
          row: 0,
          message: "File không có dữ liệu",
        },
      ],
    };
  }

  // Validate headers
  const firstRow = normalizedData[0];
  const headers = Object.keys(firstRow);

  // Kiểm tra header linh hoạt hơn (chấp nhận chứa từ khóa)
  const missingHeaders = REQUIRED_HEADERS.filter((required) => {
    return !headers.some((h) => h.includes(required));
  });

  if (missingHeaders.length > 0) {
    return {
      success: false,
      sections: [],
      courses: [],
      totalRows: normalizedData.length,
      errorRows: 0,
      errors: [
        {
          row: 0,
          message: `Thiếu các cột bắt buộc: ${missingHeaders.join(", ")}`,
        },
      ],
    };
  }

  // Parse từng dòng
  normalizedData.forEach((row, index) => {
    try {
      const section = parseRow(row, index, isPracticalSheet);
      if (section) {
        sections.push(section);
      }
    } catch (error) {
      errors.push({
        row: index + 2, // +2 vì Excel bắt đầu từ 1 và có header row
        message: error instanceof Error ? error.message : "Unknown error",
        data: row,
      });
    }
  });

  // Group sections thành courses
  const courses = groupSectionsToCourses(sections);

  return {
    success: errors.length === 0,
    sections,
    courses,
    totalRows: normalizedData.length,
    errorRows: errors.length,
    errors,
  };
}

/**
 * Lấy giá trị từ row dựa trên alias
 */
function getVal(row: Record<string, unknown>, aliasKey: keyof typeof HEADER_ALIASES): unknown {
  const aliases = HEADER_ALIASES[aliasKey];

  // 1. Thử tìm key khớp chính xác với bất kỳ alias nào
  for (const alias of aliases) {
    if (row[alias] !== undefined) return row[alias];
  }

  // 2. Thử tìm key chứa alias (ví dụ: "MÃ LỚP HỌC" chứa "MÃ LỚP")
  const rowKeys = Object.keys(row);
  for (const alias of aliases) {
    const foundKey = rowKeys.find((k) => {
      const includes = k.includes(alias);
      if (!includes) return false;

      // Tránh nhầm lẫn giữa Tên GV và Mã GV khi dùng alias "GV"
      if (alias === "GV" && k.includes("MÃ")) return false;

      // Tránh nhầm lẫn giữa Thực hành và Thứ khi dùng alias "TH"
      if (alias === "TH" && k === "THỨ") return false;

      return true;
    });
    if (foundKey) return row[foundKey];
  }

  return undefined;
}

/**
 * Parse một dòng dữ liệu thành ClassSection
 * @param row - Object chứa dữ liệu dòng
 * @param index - Index của dòng
 * @param isPracticalSheet - True nếu sheet này là sheet thực hành
 * @returns ClassSection hoặc null nếu dòng trống
 */
function parseRow(row: Record<string, unknown>, index: number, isPracticalSheet: boolean = false): ClassSection | null {
  // Lấy các giá trị cần thiết
  const classCode = getString(getVal(row, "classCode"));
  const courseName = getString(getVal(row, "courseName"));

  // Skip dòng trống
  if (!classCode && !courseName) {
    return null;
  }

  // Validate các field bắt buộc
  if (!classCode) {
    throw new Error("Thiếu MÃ LỚP");
  }

  const courseCode = getString(getVal(row, "courseCode")) || classCode.split(".")[0];
  const dayResult = parseDay(getVal(row, "day"));
  const periodsResult = parsePeriods(getVal(row, "periods"));

  // Chỉ validate nếu không phải linh hoạt
  if (!dayResult.isFlexible && dayResult.day === null) {
    throw new Error("THỨ không hợp lệ");
  }

  if (!periodsResult.isFlexible && !periodsResult.periods) {
    throw new Error("TIẾT không hợp lệ");
  }

  // Parse tiết bắt đầu và số tiết
  const { startPeriod, periodCount } = parsePeriodInfo(periodsResult.periods || "*");

  // Xác định isPractical: ưu tiên từ cột THỰC HÀNH, nếu không có thì dựa vào tên sheet
  const isPracticalFromColumn = parseBoolean(getVal(row, "isPractical"));
  const isPractical = isPracticalFromColumn || isPracticalSheet;

  return {
    id: `${classCode}-${index}`,
    courseCode,
    classCode,
    courseName: courseName || courseCode,
    lecturer: getString(getVal(row, "lecturer")) || "Chưa có thông tin",
    lecturerCode: getString(getVal(row, "lecturerCode")),
    credits: parseNumber(getVal(row, "credits")) || 0,
    isPractical,
    dayOfWeek: dayResult.day,
    isFlexibleDay: dayResult.isFlexible,
    periods: periodsResult.periods || "*",
    startPeriod,
    periodCount,
    isFlexiblePeriod: periodsResult.isFlexible,
    startDate: parseDate(getVal(row, "startDate")),
    endDate: parseDate(getVal(row, "endDate")),
    maxStudents: parseNumber(getVal(row, "maxStudents")),
    room: getString(getVal(row, "room")),
    weekType: parseNumber(getVal(row, "weekType")),
    note: getString(getVal(row, "note")),
    semester: parseNumber(getVal(row, "semester")),
    academicYear: getString(getVal(row, "academicYear")),
  };
}

/**
 * Parse cột TIẾT thành thông tin tiết học
 * @param periods - Chuỗi tiết (ví dụ: "1,2,3,4,5", "10,11,12", hoặc "*")
 * @returns Object chứa startPeriod và periodCount
 */
function parsePeriodInfo(periods: string): { startPeriod: number; periodCount: number } {
  // Nếu là linh hoạt, return giá trị mặc định
  if (periods === "*") {
    return { startPeriod: 0, periodCount: 0 };
  }

  // Tất cả periods đều ở dạng comma-separated sau khi qua parsePeriods
  const nums = periods
    .split(",")
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n) && n > 0);

  if (nums.length === 0) {
    return { startPeriod: 0, periodCount: 0 };
  }

  // Sắp xếp để lấy tiết đầu tiên
  const sorted = [...nums].sort((a, b) => a - b);

  return {
    startPeriod: sorted[0],
    periodCount: nums.length,
  };
}

/**
 * Group các ClassSection thành Course theo tên môn học
 * @param sections - Danh sách ClassSection
 * @returns Danh sách Course
 */
function groupSectionsToCourses(sections: ClassSection[]): Course[] {
  const courseMap = new Map<string, Course>();

  sections.forEach((section) => {
    const key = section.courseName;

    if (!courseMap.has(key)) {
      courseMap.set(key, {
        id: section.courseCode,
        courseCode: section.courseCode,
        courseName: section.courseName,
        credits: section.credits,
        hasPracticalClass: false,
        hasTheoryClass: false,
        sections: [],
        lecturers: [],
      });
    }

    const course = courseMap.get(key)!;
    course.sections.push(section);

    // Update practical/theory flags
    if (section.isPractical) {
      course.hasPracticalClass = true;
    } else {
      course.hasTheoryClass = true;
    }

    // Thêm giảng viên nếu chưa có
    if (section.lecturer && !course.lecturers.includes(section.lecturer)) {
      course.lecturers.push(section.lecturer);
    }

    // Update credits nếu cần
    if (section.credits > course.credits) {
      course.credits = section.credits;
    }
  });

  return Array.from(courseMap.values());
}

// ============ Helper functions ============

/**
 * Convert giá trị thành string
 */
function getString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Convert giá trị thành number
 */
function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const num = Number(value);
  return isNaN(num) ? undefined : num;
}

/**
 * Parse cột THỨ thành object { day, isFlexible }
 * - Thứ 2-7 (Thứ 2 = 2, Thứ 7 = 7)
 * - Dấu * = linh hoạt (giảng viên dạy bất cứ thứ nào)
 */
function parseDay(value: unknown): { day: number | null; isFlexible: boolean } {
  const str = getString(value);
  if (!str) return { day: null, isFlexible: false };

  // Check nếu là dấu * (linh hoạt)
  if (str.trim() === "*") {
    return { day: null, isFlexible: true };
  }

  // Nếu là số trực tiếp
  const num = Number(str);
  if (!isNaN(num) && num >= 2 && num <= 8) {
    return { day: num, isFlexible: false };
  }

  // Parse text
  const dayMap: Record<string, number> = {
    hai: 2,
    "2": 2,
    "thứ 2": 2,
    "thứ hai": 2,
    t2: 2,
    ba: 3,
    "3": 3,
    "thứ 3": 3,
    "thứ ba": 3,
    t3: 3,
    tư: 4,
    "4": 4,
    "thứ 4": 4,
    "thứ tư": 4,
    t4: 4,
    năm: 5,
    "5": 5,
    "thứ 5": 5,
    "thứ năm": 5,
    t5: 5,
    sáu: 6,
    "6": 6,
    "thứ 6": 6,
    "thứ sáu": 6,
    t6: 6,
    bảy: 7,
    "7": 7,
    "thứ 7": 7,
    "thứ bảy": 7,
    t7: 7,
    cn: 8,
    "chủ nhật": 8,
    "8": 8,
  };

  const lowerStr = str.toLowerCase();
  const day = dayMap[lowerStr];
  return { day: day || null, isFlexible: false };
}

/**
 * Parse cột TIẾT thành object { periods, isFlexible }
 * - Tiết 1-9: Ký tự đơn (1,2,3,...,9)
 * - Tiết 10: Ký tự 0
 * - Tiết 11+: Dùng dấu phẩy (10,11,12) hoặc nhiều chữ số
 * - Dấu * = linh hoạt
 */
function parsePeriods(value: unknown): { periods: string | null; isFlexible: boolean } {
  const str = getString(value);
  if (!str) return { periods: null, isFlexible: false };

  // Check nếu là dấu * (linh hoạt)
  if (str.trim() === "*") {
    return { periods: "*", isFlexible: true };
  }

  // Nếu là dạng range (1-5 hoặc 10-13)
  const rangeMatch = str.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]);
    const end = parseInt(rangeMatch[2]);
    const result: number[] = [];
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    return { periods: result.join(","), isFlexible: false };
  }

  // Nếu có dấu phẩy (10,11,12)
  if (str.includes(",")) {
    const periods = str
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s)
      .join(",");
    return { periods, isFlexible: false };
  }

  // Nếu đã là chuỗi số liên tục (12345 hoặc 67890)
  // Lưu ý: 0 = tiết 10
  if (/^\d+$/.test(str)) {
    // Convert: 0 -> 10, giữ nguyên các số khác
    const converted = str
      .split("")
      .map((char) => (char === "0" ? "10" : char))
      .join(",");
    return { periods: converted, isFlexible: false };
  }

  return { periods: str, isFlexible: false };
}

/**
 * Parse giá trị boolean từ cột THỰC HÀNH
 */
function parseBoolean(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;

  const str = getString(value).toLowerCase();
  return str === "1" || str === "true" || str === "th" || str === "x" || str === "yes";
}

/**
 * Parse date từ cột NBD/NKT
 */
function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;

  // Nếu đã là Date object (Excel date)
  if (value instanceof Date && isValid(value)) {
    return value;
  }

  const str = getString(value);
  if (!str) return null;

  // Thử các format phổ biến
  const formats = ["yyyy-MM-dd", "dd-MM-yyyy", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy/MM/dd"];

  for (const format of formats) {
    const parsed = parse(str, format, new Date());
    if (isValid(parsed)) {
      return parsed;
    }
  }

  // Thử native Date parse
  const nativeDate = new Date(str);
  if (isValid(nativeDate)) {
    return nativeDate;
  }

  return null;
}

/**
 * Validate xem dữ liệu parse có hợp lệ không
 */
export function validateParseResult(result: ParseResult): string[] {
  const warnings: string[] = [];

  if (result.errorRows > 0) {
    warnings.push(`Có ${result.errorRows} dòng lỗi không được import`);
  }

  if (result.sections.length === 0) {
    warnings.push("Không có dữ liệu lớp học nào được import");
  }

  return warnings;
}
