import type { ClassSection, ScheduledClass } from "@/types";
import { checkConflict } from "@/lib/schedule-utils";

/**
 * Lọc các section hợp lệ - không trùng lớp đã đăng ký chính xác, khớp mã LT-TH
 */
export function filterValidSections(
  sections: ClassSection[],
  scheduledClasses: ScheduledClass[],
  pendingTheorySection: ClassSection | null
): ClassSection[] {
  return sections.filter((section) => {
    const registeredSections = scheduledClasses
      .filter((sc) => sc.classSection.courseCode === section.courseCode)
      .map((sc) => sc.classSection);

    // 1. Bỏ qua nếu chính lớp này đã được đăng ký
    const exactClass = registeredSections.find((s) => s.classCode === section.classCode);
    if (exactClass) return false;

    // 2. Kiểm tra tính hợp lệ giữa LT và TH khi đang chọn TH cho pending LT
    if (section.isPractical) {
      if (pendingTheorySection) {
        return section.classCode.startsWith(pendingTheorySection.classCode + ".");
      }
    }
    return true;
  });
}

/**
 * Tìm tất cả các ScheduledClass bị xung đột với newSection (trùng giờ hoặc trùng môn cùng loại)
 */
export function getConflictingScheduledClasses(
  newSection: ClassSection,
  scheduledClasses: ScheduledClass[]
): ScheduledClass[] {
  const result: ScheduledClass[] = [];
  const addedIds = new Set<string>();

  // 1. Direct time/schedule conflicts
  for (const sc of scheduledClasses) {
    if (checkConflict(newSection, sc.classSection)) {
      if (!addedIds.has(sc.id)) {
        result.push(sc);
        addedIds.add(sc.id);
      }
    }
  }

  // 2. Same course + same type (ví dụ: thay thế LT cũ bằng LT mới của cùng môn)
  for (const sc of scheduledClasses) {
    if (
      sc.classSection.courseCode === newSection.courseCode &&
      sc.classSection.isPractical === newSection.isPractical
    ) {
      if (!addedIds.has(sc.id)) {
        result.push(sc);
        addedIds.add(sc.id);
      }
    }
  }

  // 3. Lớp đi kèm với các lớp bị trùng (LT xóa TH, TH xóa LT)
  for (const sc of [...result]) {
    const paired = findPairedClass(sc.classSection, scheduledClasses);
    if (paired && !addedIds.has(paired.id)) {
      result.push(paired);
      addedIds.add(paired.id);
    }
  }

  return result;
}

/**
 * Kiểm tra loại class đã đăng ký (để tránh đăng ký duplicate)
 */
export function checkDuplicateTypeRegistration(
  section: ClassSection,
  scheduledClasses: ScheduledClass[]
): { isDuplicate: boolean; typeStr: string } {
  const registeredSections = scheduledClasses
    .filter((sc) => sc.classSection.courseCode === section.courseCode)
    .map((sc) => sc.classSection);

  const sameTypeClass = registeredSections.find((s) => s.isPractical === section.isPractical);
  const typeStr = section.isPractical ? "THỰC HÀNH" : "LÝ THUYẾT";

  return {
    isDuplicate: !!sameTypeClass,
    typeStr,
  };
}

/**
 * Kiểm tra xem lớp TH có khớp với pending LT không
 */
export function validatePracticalWithPendingTheory(
  section: ClassSection,
  pendingTheorySection: ClassSection | null
): { isValid: boolean; error?: string } {
  if (!section.isPractical || !pendingTheorySection) {
    return { isValid: true };
  }

  if (!section.classCode.startsWith(pendingTheorySection.classCode + ".")) {
    return {
      isValid: false,
      error: `Lớp thực hành "${section.classCode}" không khớp với lớp lý thuyết "${pendingTheorySection.classCode}" đã chọn!`,
    };
  }

  return { isValid: true };
}

/**
 * Tìm lớp đi kèm (LT tìm TH, TH tìm LT)
 */
export function findPairedClass(
  removedSection: ClassSection,
  scheduledClasses: ScheduledClass[]
): ScheduledClass | undefined {
  if (removedSection.isPractical) {
    // Đang xóa TH, tìm LT đi kèm
    // Mã TH có dạng "LT_CODE.1", "LT_CODE.2", etc.
    const theoryClassCode = removedSection.classCode.split(".").slice(0, -1).join(".");
    return scheduledClasses.find(
      (sc) =>
        sc.classSection.courseCode === removedSection.courseCode &&
        !sc.classSection.isPractical &&
        sc.classSection.classCode === theoryClassCode
    );
  }

  // Đang xóa LT, tìm TH đi kèm
  return scheduledClasses.find(
    (sc) =>
      sc.classSection.courseCode === removedSection.courseCode &&
      sc.classSection.isPractical &&
      sc.classSection.classCode.startsWith(removedSection.classCode + ".")
  );
}

/**
 * Tính tổng tín chỉ không trùng lặp
 */
export function calculateTotalCredits(scheduledClasses: ScheduledClass[]): number {
  return scheduledClasses.reduce((sum, sc) => sum + (sc.classSection.credits || 0), 0);
}
