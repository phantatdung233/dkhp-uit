/**
 * Định nghĩa kiểu dữ liệu (Type Definitions) cho ứng dụng xếp TKB UIT.
 */

/**
 * Đại diện cho một lớp học phần cụ thể từ dữ liệu TKB.
 */
export interface ClassSection {
  /** ID duy nhất định danh lớp học phần */
  id: string;
  /** Mã môn học (ví dụ: IT001) */
  courseCode: string;
  /** Mã lớp học phần (ví dụ: IT001.N11) */
  classCode: string;
  /** Tên môn học */
  courseName: string;
  /** Giảng viên phụ trách */
  lecturer: string;
  /** Mã giảng viên (nếu có) */
  lecturerCode?: string;
  /** Số tín chỉ */
  credits: number;
  /** True nếu là lớp thực hành */
  isPractical: boolean;
  /** Thứ trong tuần (2: Thứ 2 ... 7: Thứ 7, null nếu là môn linh hoạt/online) */
  dayOfWeek: number | null;
  /** True nếu thứ học linh hoạt (dấu '*') */
  isFlexibleDay: boolean;
  /** Danh sách tiết học dạng chuỗi (ví dụ: "1,2,3" hoặc "*") */
  periods: string;
  /** Tiết bắt đầu (0 nếu là tiết linh hoạt) */
  startPeriod: number;
  /** Tổng số tiết học */
  periodCount: number;
  /** True nếu tiết học linh hoạt (dấu '*') */
  isFlexiblePeriod: boolean;
  /** Ngày bắt đầu học phần */
  startDate: Date | null;
  /** Ngày kết thúc học phần */
  endDate: Date | null;
  /** Sĩ số tối đa */
  maxStudents?: number;
  /** Phòng học */
  room?: string;
  /** 0: học hàng tuần, 1: học cách tuần */
  weekType?: number;
  note?: string;
  semester?: number;
  academicYear?: string;
  /** Khóa học quản lý (Cột O) */
  cohort?: string;
  /** Khoa quản lý môn học (Cột S) */
  faculty?: string;
}

/**
 * Đại diện cho một môn học (gom nhóm các ClassSection cùng mã môn).
 */
export interface Course {
  id: string;
  courseCode: string;
  courseName: string;
  credits: number;
  hasPracticalClass: boolean;
  hasTheoryClass: boolean;
  theoryCredits?: number;
  practicalCredits?: number;
  sections: ClassSection[];
  lecturers: string[];
  cohorts?: string[];
  faculties?: string[];
}

/**
 * Ô thời gian cụ thể trên lưới thời khóa biểu.
 */
export interface TimeSlot {
  /** ID ô dạng `Thứ-Tiết` (ví dụ: "2-1") */
  id: string;
  /** Thứ trong tuần (2-7) */
  dayOfWeek: number;
  /** Tiết học (1-15) */
  period: number;
}

/**
 * Lớp học phần đã được chọn vào một phương án TKB.
 */
export interface ScheduledClass {
  id: string;
  classSection: ClassSection;
  addedAt: Date;
}

export type ConflictType =
  | "time_overlap"      // Trùng tiết học cùng ngày
  | "date_overlap"      // Trùng khoảng thời gian ngày học
  | "missing_practical" // Đã chọn LT nhưng thiếu lớp TH bắt buộc
  | "missing_theory";   // Đã chọn TH nhưng thiếu lớp LT

/**
 * Thông tin chi tiết về xung đột lịch học.
 */
export interface Conflict {
  id: string;
  type: ConflictType;
  message: string;
  conflictingClasses: ClassSection[];
  conflictingSlots: TimeSlot[];
}

/**
 * Kết quả xử lý khi kéo/thả lớp học vào ô thời gian.
 */
export interface DropResult {
  success: boolean;
  message: string;
  options?: ClassSection[];
  conflict?: Conflict;
}

/**
 * Bộ lọc danh sách môn học và lớp học phần.
 */
export interface FilterOptions {
  searchQuery: string;
  lecturerFilter: string;
  showUnregisteredOnly: boolean;
  classType: "all" | "theory" | "practical";
  specialGroup?: string;
  cohortFilter?: string;
  facultyFilter?: string;
}

/**
 * Thông tin highlight ô thời gian khi kéo hoặc click chọn môn.
 */
export interface HighlightedSlot {
  slot: TimeSlot;
  availableSections: ClassSection[];
  conflictingSections?: ClassSection[];
  hasConflict: boolean;
}

/**
 * Bảng ánh xạ chỉ số cột từ file Excel TKB.
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
 * Đại diện cho một phương án thời khóa biểu độc lập.
 */
export interface Schedule {
  id: string;
  name: string;
  scheduledClasses: ScheduledClass[];
  totalCredits: number;
  warnings: Conflict[];
  createdAt: number;
}

export interface ParseError {
  row: number;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Kết quả phân tích cú pháp dữ liệu file Excel.
 */
export interface ParseResult {
  success: boolean;
  sections: ClassSection[];
  courses: Course[];
  totalRows: number;
  errorRows: number;
  errors: ParseError[];
}

/**
 * Bảng ánh xạ tiết học sang khung giờ thực tế theo quy định UIT.
 */
export const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  // Sáng (Tiết 1 - 5)
  1: { start: "07:30", end: "08:15" },
  2: { start: "08:15", end: "09:00" },
  3: { start: "09:00", end: "09:45" },
  4: { start: "09:45", end: "10:30" },
  5: { start: "10:45", end: "11:30" },
  // Chiều (Tiết 6 - 10)
  6: { start: "13:00", end: "13:45" },
  7: { start: "13:45", end: "14:30" },
  8: { start: "14:30", end: "15:15" },
  9: { start: "15:15", end: "16:00" },
  10: { start: "16:15", end: "17:00" },
  // Tối (Tiết 11 - 15)
  11: { start: "17:30", end: "18:15" },
  12: { start: "18:15", end: "19:00" },
  13: { start: "19:00", end: "19:45" },
  14: { start: "19:45", end: "20:30" },
  15: { start: "20:30", end: "21:15" },
};

/**
 * Bảng tên các ngày học trong tuần.
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
 * Bảng màu giao diện cho các môn học trên thời khóa biểu.
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
