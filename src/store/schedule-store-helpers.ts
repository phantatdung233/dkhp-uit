import type { ClassSection, ScheduledClass } from "@/types";
import { checkConflict } from "@/lib/schedule-utils";

/**
 * Lọc danh sách các lớp học phần hợp lệ: không trùng lớp đã đăng ký và khớp mã LT-TH khi đang chọn thực hành.
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

    // Bỏ qua nếu chính lớp này đã được đăng ký
    const exactClass = registeredSections.find((s) => s.classCode === section.classCode);
    if (exactClass) return false;

    // Kiểm tra tính hợp lệ khi đang chọn lớp thực hành cho lớp lý thuyết chờ (pending)
    if (section.isPractical) {
      if (pendingTheorySection) {
        return section.classCode.startsWith(pendingTheorySection.classCode + ".");
      }
    }
    return true;
  });
}

/**
 * Tìm tất cả các ScheduledClass bị xung đột khi thêm lớp mới (xung đột giờ học, trùng loại môn, hoặc lớp đi kèm bị ảnh hưởng).
 */
export function getConflictingScheduledClasses(
  newSection: ClassSection,
  scheduledClasses: ScheduledClass[]
): ScheduledClass[] {
  const result: ScheduledClass[] = [];
  const addedIds = new Set<string>();

  // Kiểm tra trùng lịch trực tiếp
  for (const sc of scheduledClasses) {
    if (checkConflict(newSection, sc.classSection)) {
      if (!addedIds.has(sc.id)) {
        result.push(sc);
        addedIds.add(sc.id);
      }
    }
  }

  // Kiểm tra cùng môn và cùng loại (ví dụ: thay thế LT cũ bằng LT mới của cùng môn)
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

  // Tìm lớp đi kèm của các lớp bị trùng (LT xóa kèm TH, TH xóa kèm LT)
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
 * Kiểm tra xem loại lớp (Lý thuyết hoặc Thực hành) của môn học này đã được đăng ký trong lịch chưa.
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
 * Kiểm tra xem lớp thực hành có tiền tố mã lớp khớp với lớp lý thuyết đang chờ (pending) hay không.
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
 * Tìm lớp học phần đi kèm trong lịch (LT tìm lớp TH tương ứng, hoặc TH tìm lớp LT cha).
 */
export function findPairedClass(
  removedSection: ClassSection,
  scheduledClasses: ScheduledClass[]
): ScheduledClass | undefined {
  if (removedSection.isPractical) {
    const theoryClassCode = removedSection.classCode.split(".").slice(0, -1).join(".");
    return scheduledClasses.find(
      (sc) =>
        sc.classSection.courseCode === removedSection.courseCode &&
        !sc.classSection.isPractical &&
        sc.classSection.classCode === theoryClassCode
    );
  }

  return scheduledClasses.find(
    (sc) =>
      sc.classSection.courseCode === removedSection.courseCode &&
      sc.classSection.isPractical &&
      sc.classSection.classCode.startsWith(removedSection.classCode + ".")
  );
}

/**
 * Tính tổng số tín chỉ của danh sách lớp đã xếp lịch.
 */
export function calculateTotalCredits(scheduledClasses: ScheduledClass[]): number {
  return scheduledClasses.reduce((sum, sc) => sum + (sc.classSection.credits || 0), 0);
}

