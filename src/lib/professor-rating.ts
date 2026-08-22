/**
 * Module tra cứu và chuẩn hóa đánh giá giảng viên.
 */

import reviewsData from "@/data/professor-reviews.json";

export interface ProfessorReview {
  text: string;
  rating: number;
  courseName: string;
}

export interface ProfessorData {
  name: string;
  averageRating: number;
  totalReviews: number;
  reviews: ProfessorReview[];
}

/**
 * Danh sách các tiền tố học hàm / học vị phổ biến cần loại bỏ khi so khớp tên.
 */
const TITLE_PREFIXES = [
  /^pgs\.\s*ts\./i,
  /^gs\.\s*ts\./i,
  /^pgs\./i,
  /^gs\./i,
  /^ts\./i,
  /^ths\.\s*kts\./i,
  /^ths\./i,
  /^th\.s\./i,
  /^t\.s\./i,
  /^cn\./i,
  /^ncs\./i,
  /^kts\./i,
  /^ts\s+/i,
  /^ths\s+/i,
  /^cn\s+/i,
  /^gv\./i,
  /^cô\s+/i,
  /^thầy\s+/i,
];

/**
 * Chuẩn hóa tên giảng viên để tìm kiếm chính xác (bỏ học hàm, học vị, khoảng trắng thừa, lowercase).
 */
export function normalizeProfessorName(name: string): string {
  if (!name) return "";
  let clean = name.trim().normalize("NFC");

  // Loại bỏ các tiền tố học hàm học vị
  for (const prefix of TITLE_PREFIXES) {
    clean = clean.replace(prefix, "").trim();
  }

  // Loại bỏ khoảng trắng thừa
  clean = clean.replace(/\s+/g, " ").toLowerCase();
  return clean;
}

// Xây dựng Map tra cứu nhanh theo tên chuẩn hóa
const professorMap = new Map<string, ProfessorData>();

if (reviewsData && Array.isArray((reviewsData as { professors?: ProfessorData[] }).professors)) {
  for (const prof of (reviewsData as { professors: ProfessorData[] }).professors) {
    if (prof.name) {
      const key = normalizeProfessorName(prof.name);
      professorMap.set(key, prof);
    }
  }
}

/**
 * Tìm thông tin đánh giá của giảng viên theo tên (hỗ trợ tên có học vị hoặc tên ghép).
 */
export function getProfessorReview(lecturerName: string): ProfessorData | null {
  if (!lecturerName || lecturerName === "Chưa có thông tin" || lecturerName === "Chưa có GV") {
    return null;
  }

  // 1. Tìm trực tiếp theo tên đã chuẩn hóa
  const normalized = normalizeProfessorName(lecturerName);
  if (professorMap.has(normalized)) {
    return professorMap.get(normalized)!;
  }

  // 2. Nếu tên chứa nhiều giảng viên (ngăn cách bằng dấu phẩy, gạch chéo, hoặc "và"), lấy giảng viên đầu tiên
  const subNames = lecturerName.split(/[,;/&]|\bvà\b/i).map((s) => s.trim()).filter(Boolean);
  if (subNames.length > 1) {
    for (const sub of subNames) {
      const subNorm = normalizeProfessorName(sub);
      if (professorMap.has(subNorm)) {
        return professorMap.get(subNorm)!;
      }
    }
  }

  // 3. Tìm kiếm gần đúng (nếu tên trong database chứa tên đầu vào hoặc ngược lại)
  for (const [key, prof] of professorMap.entries()) {
    if (key.length >= 4 && (normalized.includes(key) || key.includes(normalized))) {
      return prof;
    }
  }

  return null;
}

/**
 * Lấy điểm số trung bình và số lượng review của giảng viên.
 */
export function getProfessorRating(
  lecturerName: string
): { averageRating: number; totalReviews: number } | null {
  const prof = getProfessorReview(lecturerName);
  if (!prof || prof.totalReviews === 0) {
    return null;
  }
  return {
    averageRating: prof.averageRating,
    totalReviews: prof.totalReviews,
  };
}

/**
 * Trả về màu sắc styling dựa trên điểm đánh giá trung bình.
 */
export function getRatingBadgeStyle(rating: number) {
  if (rating >= 4.5) {
    return {
      bg: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      star: "text-amber-500 fill-amber-400",
    };
  }
  if (rating >= 3.5) {
    return {
      bg: "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
      star: "text-amber-500 fill-amber-400",
    };
  }
  if (rating >= 2.5) {
    return {
      bg: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
      star: "text-amber-500 fill-amber-400",
    };
  }
  return {
    bg: "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
    star: "text-red-500 fill-red-400",
  };
}
