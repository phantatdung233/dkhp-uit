/**
 * TypeScript Interfaces for Schedule Planner Application
 * ======================================================
 * Định nghĩa các kiểu dữ liệu chính cho ứng dụng sắp xếp thời khóa biểu
 */

/**
 * ClassSection - Đại diện cho một lớp học phần cụ thể
 * Mỗi môn học có thể có nhiều ClassSection (khác giảng viên, khác giờ)
 */
export interface ClassSection {
  /** Unique ID - tự tạo từ MÃ LỚP + index để đảm bảo unique */
  id: string;

  /** MÃ MH - Mã môn học */
  courseCode: string;

  /** MÃ LỚP - Mã lớp học phần */
  classCode: string;

  /** TÊN MÔN HỌC */
  courseName: string;

  /** TÊN GIẢNG VIÊN */
  lecturer: string;

  /** MÃ GIẢNG VIÊN */
  lecturerCode?: string;

  /** SỐ TC - Số tín chỉ */
  credits: number;

  /** THỰC HÀNH - true nếu là lớp thực hành */
  isPractical: boolean;

  /** THỨ - Ngày trong tuần (2-7 cho Thứ 2 đến Thứ 7, hoặc CN = 8), null nếu là * (linh hoạt) */
  dayOfWeek: number | null;

  /** Có phải thứ linh hoạt không (dấu *) */
  isFlexibleDay: boolean;

  /** TIẾT - Chuỗi string các tiết học, ví dụ "12345" hoặc "*" */
  periods: string;

  /** Tiết bắt đầu - Parse từ periods, 0 nếu là tiết linh hoạt */
  startPeriod: number;

  /** Số tiết học - Tính từ length của periods */
  periodCount: number;

  /** Có phải tiết linh hoạt không (dấu *) */
  isFlexiblePeriod: boolean;

  /** NBD - Ngày bắt đầu */
  startDate: Date | null;

  /** NKT - Ngày kết thúc */
  endDate: Date | null;

  /** SĨ SỐ - Số lượng sinh viên tối đa */
  maxStudents?: number;

  /** PHÒNG HỌC */
  room?: string;

  /** CÁCH TUẦN - 0: hàng tuần, 1: cách tuần */
  weekType?: number;

  /** GHI CHÚ */
  note?: string;

  /** HỌC KỲ */
  semester?: number;

  /** NĂM HỌC */
  academicYear?: string;
}

/**
 * Course - Đại diện cho một môn học (group các ClassSection cùng courseName)
 */
export interface Course {
  /** Unique ID từ courseCode */
  id: string;

  /** MÃ MH */
  courseCode: string;

  /** TÊN MÔN HỌC */
  courseName: string;

  /** SỐ TC */
  credits: number;

  /** Có lớp thực hành không */
  hasPracticalClass: boolean;

  /** Có lớp lý thuyết không */
  hasTheoryClass: boolean;

  /** Số tín chỉ lý thuyết */
  theoryCredits?: number;

  /** Số tín chỉ thực hành */
  practicalCredits?: number;

  /** Danh sách các lớp học phần */
  sections: ClassSection[];

  /** Danh sách giảng viên dạy môn này */
  lecturers: string[];
}

/**
 * TimeSlot - Đại diện cho một ô thời gian trên lịch
 */
export interface TimeSlot {
  /** ID của slot: day-period format */
  id: string;

  /** Ngày trong tuần (2-7) */
  dayOfWeek: number;

  /** Tiết học (1-15) */
  period: number;
}

/**
 * ScheduledClass - Lớp học đã được xếp vào lịch
 */
export interface ScheduledClass {
  /** ID unique */
  id: string;

  /** ClassSection được xếp */
  classSection: ClassSection;

  /** Thời gian xếp vào lịch */
  addedAt: Date;
}

/**
 * Conflict - Thông tin về xung đột lịch học
 */
export interface Conflict {
  /** ID unique của conflict */
  id: string;

  /** Loại conflict */
  type: ConflictType;

  /** Mô tả conflict */
  message: string;

  /** Các lớp bị conflict */
  conflictingClasses: ClassSection[];

  /** Các slot bị conflict */
  conflictingSlots: TimeSlot[];
}

export type ConflictType =
  | "time_overlap" // Trùng tiết cùng ngày
  | "date_overlap" // Trùng khoảng thời gian NBD-NKT
  | "missing_practical" // Thiếu lớp thực hành
  | "missing_theory"; // Thiếu lớp lý thuyết

/**
 * DropResult - Kết quả sau khi thả
 */
export interface DropResult {
  /** Thả thành công hay không */
  success: boolean;

  /** Thông báo */
  message: string;

  /** Nếu có nhiều option, danh sách classes để chọn */
  options?: ClassSection[];

  /** Conflict nếu có */
  conflict?: Conflict;
}

/**
 * FilterOptions - Tùy chọn lọc danh sách môn
 */
export interface FilterOptions {
  /** Tìm kiếm theo tên môn hoặc mã môn */
  searchQuery: string;

  /** Lọc theo giảng viên */
  lecturerFilter: string;

  /** Chỉ hiện môn chưa đăng ký */
  showUnregisteredOnly: boolean;

  /** Lọc theo loại (lý thuyết/thực hành) */
  classType: "all" | "theory" | "practical";

  /** Lọc theo nhóm đặc biệt (none, ANTT, TTNT, ...) */
  specialGroup?: string;
}

/**
 * HighlightedSlot - Thông tin về slot được highlight khi kéo
 */
export interface HighlightedSlot {
  /** TimeSlot info */
  slot: TimeSlot;

  /** Các ClassSection có thể thả vào slot này */
  availableSections: ClassSection[];

  /** Các ClassSection bị trùng lịch ở slot này */
  conflictingSections?: ClassSection[];

  /** Có conflict với lịch hiện tại không */
  hasConflict: boolean;
}

/**
 * ExcelHeader - Mapping header từ file Excel
 */
export interface ExcelHeaderMapping {
  STT: number;
  "MÃ MH": number;
  "MÃ LỚP": number;
  "TÊN MÔN HỌC": number;
  "MÃ GIẢNG VIÊN": number;
  "TÊN GIẢNG VIÊN": number;
  "SĨ SỐ": number;
  "SỐ TC": number;
  "THỰC HÀNH": number;
  HTGD: number;
  THỨ: number;
  TIẾT: number;
  "CÁCH TUẦN": number;
  "PHÒNG HỌC": number;
  "KHOÁ HỌC": number;
  "HỌC KỲ": number;
  "NĂM HỌC": number;
  "HỆ ĐT": number;
  "KHOA QL": number;
  NBD: number;
  NKT: number;
  GHICHU: number;
  "Đã ĐK": number;
}

/**
 * Schedule - Đại diện cho một phương án thời khóa biểu
 */
export interface Schedule {
  id: string;
  name: string;
  scheduledClasses: ScheduledClass[];
  totalCredits: number;
  warnings: Conflict[];
  createdAt: number;
}

/**
 * ParseResult - Kết quả parse file Excel
 */
export interface ParseResult {
  /** Thành công hay không */
  success: boolean;

  /** Danh sách ClassSection đã parse */
  sections: ClassSection[];

  /** Danh sách Course đã group */
  courses: Course[];

  /** Số dòng đã parse */
  totalRows: number;

  /** Số dòng lỗi */
  errorRows: number;

  /** Chi tiết lỗi */
  errors: ParseError[];
}

export interface ParseError {
  /** Số dòng lỗi */
  row: number;

  /** Mô tả lỗi */
  message: string;

  /** Dữ liệu dòng lỗi */
  data?: Record<string, unknown>;
}

/**
 * Period time ranges - Mapping tiết học sang giờ thực tế
 * Tiết 1-5: Sáng (7:30 - 11:30)
 * Nghỉ trưa: 11:30 - 13:00
 * Tiết 6-10: Chiều (13:00 - 17:00)
 * Tiết 11-15: Tối (17:30 - 21:15)
 */
export const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  // Sáng - bắt đầu 7:30
  1: { start: "07:30", end: "08:15" },
  2: { start: "08:15", end: "09:00" },
  3: { start: "09:00", end: "09:45" },
  4: { start: "09:45", end: "10:30" },
  5: { start: "10:45", end: "11:30" },
  // Chiều - bắt đầu 13:00, kết thúc 17:00
  6: { start: "13:00", end: "13:45" },
  7: { start: "13:45", end: "14:30" },
  8: { start: "14:30", end: "15:15" },
  9: { start: "15:15", end: "16:00" },
  10: { start: "16:15", end: "17:00" },
  // Tối - các tiết ngoài giờ
  11: { start: "17:30", end: "18:15" },
  12: { start: "18:15", end: "19:00" },
  13: { start: "19:00", end: "19:45" },
  14: { start: "19:45", end: "20:30" },
  15: { start: "20:30", end: "21:15" },
};

/**
 * Day names - Tên các ngày trong tuần
 */
export const DAY_NAMES: Record<number, string> = {
  2: "Thứ 2",
  3: "Thứ 3",
  4: "Thứ 4",
  5: "Thứ 5",
  6: "Thứ 6",
  7: "Thứ 7",
};

/**
 * Color palette cho các môn học (Màu đặc rõ ràng, không bị chỉ hiển thị mỗi viền)
 */
export const COURSE_COLORS = [
  "bg-emerald-100 border-emerald-300 text-emerald-950",
  "bg-teal-100 border-teal-300 text-teal-950",
  "bg-cyan-100 border-cyan-300 text-cyan-950",
  "bg-sky-100 border-sky-300 text-sky-950",
  "bg-blue-100 border-blue-300 text-blue-950",
  "bg-indigo-100 border-indigo-300 text-indigo-950",
  "bg-purple-100 border-purple-300 text-purple-950",
  "bg-rose-100 border-rose-300 text-rose-950",
  "bg-amber-100 border-amber-300 text-amber-950",
  "bg-lime-100 border-lime-300 text-lime-950",
];
