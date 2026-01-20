/**
 * Schedule Store Helpers
 * ======================
 * Helper functions extracted from schedule-store.ts
 * to reduce complexity and improve maintainability
 */

import type { ClassSection, ScheduledClass } from "@/types";

/**
 * Lọc các section hợp lệ - không trùng loại đã đăng ký, khớp mã LT-TH
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

    // 1. Kiểm tra trùng loại
    const sameTypeClass = registeredSections.find((s) => s.isPractical === section.isPractical);
    if (sameTypeClass) return false;

    // 2. Kiểm tra tính hợp lệ giữa LT và TH
    if (section.isPractical) {
      // Nếu có pending LT, chỉ hiện TH khớp với pending LT
      if (pendingTheorySection) {
        return section.classCode.startsWith(pendingTheorySection.classCode + ".");
      }
      const theoryClass = registeredSections.find((s) => !s.isPractical);
      if (theoryClass && !section.classCode.startsWith(theoryClass.classCode + ".")) {
        return false;
      }
    } else {
      const practicalClass = registeredSections.find((s) => s.isPractical);
      if (practicalClass && !practicalClass.classCode.startsWith(section.classCode + ".")) {
        return false;
      }
    }
    return true;
  });
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
