/**
 * Schedule Utilities
 * ==================
 * Các utility functions cho việc xử lý lịch học
 */

import { isWithinInterval, areIntervalsOverlapping } from "date-fns";
import type { ClassSection, Conflict, ConflictType, TimeSlot, HighlightedSlot, ScheduledClass } from "@/types";

/**
 * Kiểm tra xung đột giữa 2 ClassSection
 * @param section1 - ClassSection thứ nhất
 * @param section2 - ClassSection thứ hai
 * @returns Conflict object nếu có xung đột, null nếu không
 */
export function checkConflict(section1: ClassSection, section2: ClassSection): Conflict | null {
  // Nếu cùng một lớp thì không conflict
  if (section1.id === section2.id) {
    return null;
  }

  // Nếu một trong hai có thứ linh hoạt (*) thì không conflict về thời gian
  if (section1.isFlexibleDay || section2.isFlexibleDay) {
    return null;
  }

  // Nếu một trong hai có tiết linh hoạt (*) thì không conflict về thời gian
  if (section1.isFlexiblePeriod || section2.isFlexiblePeriod) {
    return null;
  }

  // Kiểm tra cùng thứ
  if (section1.dayOfWeek !== section2.dayOfWeek) {
    return null;
  }

  // Kiểm tra overlap tiết học
  const periods1 = getPeriodArray(section1.periods);
  const periods2 = getPeriodArray(section2.periods);
  const overlappingPeriods = periods1.filter((p) => periods2.includes(p));

  if (overlappingPeriods.length === 0) {
    return null;
  }

  // Kiểm tra overlap ngày học (nếu có thông tin NBD-NKT)
  if (section1.startDate && section1.endDate && section2.startDate && section2.endDate) {
    const interval1 = { start: section1.startDate, end: section1.endDate };
    const interval2 = { start: section2.startDate, end: section2.endDate };

    if (!areIntervalsOverlapping(interval1, interval2)) {
      return null; // Khác khoảng thời gian, không conflict
    }
  }

  // Tạo conflict slots
  const conflictingSlots: TimeSlot[] = overlappingPeriods.map((period) => ({
    id: `${section1.dayOfWeek}-${period}`,
    dayOfWeek: section1.dayOfWeek!,
    period,
  }));

  return {
    id: `conflict-${section1.id}-${section2.id}`,
    type: "time_overlap",
    message: `Trùng ${overlappingPeriods.length} tiết vào Thứ ${section1.dayOfWeek}`,
    conflictingClasses: [section1, section2],
    conflictingSlots,
  };
}

/**
 * Kiểm tra một ClassSection có xung đột với danh sách scheduled classes không
 * @param newSection - ClassSection mới muốn thêm
 * @param scheduledClasses - Danh sách lớp đã xếp
 * @returns Array of Conflicts
 */
export function checkConflictWithSchedule(newSection: ClassSection, scheduledClasses: ScheduledClass[]): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const scheduled of scheduledClasses) {
    const conflict = checkConflict(newSection, scheduled.classSection);
    if (conflict) {
      conflicts.push(conflict);
    }
  }

  return conflicts;
}

/**
 * Kiểm tra thiếu lớp thực hành/lý thuyết
 * @param section - ClassSection vừa được thêm
 * @param scheduledClasses - Danh sách lớp đã xếp
 * @param allSections - Tất cả các lớp học có sẵn
 * @returns Warning conflict nếu cần đăng ký thêm lớp
 */
export function checkMissingPairedClass(
  section: ClassSection,
  scheduledClasses: ScheduledClass[],
  allSections: ClassSection[]
): Conflict | null {
  // Lấy tất cả sections của cùng môn học
  const sameCouseSections = allSections.filter((s) => s.courseCode === section.courseCode);

  // Kiểm tra có lớp thực hành không
  const hasPracticalSections = sameCouseSections.some((s) => s.isPractical);
  const hasTheorySections = sameCouseSections.some((s) => !s.isPractical);

  // Nếu môn không có cả 2 loại, không cần warning
  if (!hasPracticalSections || !hasTheorySections) {
    return null;
  }

  // Kiểm tra đã đăng ký lớp đi kèm chưa
  const registeredSections = scheduledClasses
    .filter((sc) => sc.classSection.courseCode === section.courseCode)
    .map((sc) => sc.classSection);

  const hasRegisteredPractical = registeredSections.some((s) => s.isPractical);
  const hasRegisteredTheory = registeredSections.some((s) => !s.isPractical);

  if (section.isPractical && !hasRegisteredTheory) {
    return {
      id: `missing-theory-${section.id}`,
      type: "missing_theory",
      message: `Bạn cần đăng ký thêm lớp LÝ THUYẾT cho môn "${section.courseName}"`,
      conflictingClasses: [section],
      conflictingSlots: [],
    };
  }

  if (!section.isPractical && !hasRegisteredPractical) {
    // Tìm các mã lớp thực hành hợp lệ (bắt đầu bằng mã lớp LT + ".")
    const validPracticalCodes = sameCouseSections
      .filter((s) => s.isPractical && s.classCode.startsWith(section.classCode + "."))
      .map((s) => s.classCode);

    const message =
      validPracticalCodes.length > 0
        ? `Bạn cần đăng ký thêm lớp THỰC HÀNH (ví dụ: ${validPracticalCodes[0]}) cho lớp lý thuyết "${section.classCode}"`
        : `Bạn cần đăng ký thêm lớp THỰC HÀNH cho môn "${section.courseName}"`;

    return {
      id: `missing-practical-${section.id}`,
      type: "missing_practical",
      message,
      conflictingClasses: [section],
      conflictingSlots: [],
    };
  }

  return null;
}

/**
 * Lấy danh sách các slot được highlight khi đang kéo một course
 * @param sections - Các ClassSection của course đang kéo
 * @param scheduledClasses - Danh sách lớp đã xếp
 * @param allSections - Tất cả sections (dùng để check LT-TH pairing)
 * @returns Danh sách HighlightedSlot
 */
export function getHighlightedSlots(
  sections: ClassSection[],
  scheduledClasses: ScheduledClass[],
  allSections?: ClassSection[]
): HighlightedSlot[] {
  const slotMap = new Map<string, HighlightedSlot>();

  for (const section of sections) {
    // Bỏ qua section có thứ hoặc tiết linh hoạt
    if (section.isFlexibleDay || section.isFlexiblePeriod || section.dayOfWeek === null) {
      continue;
    }

    const periods = getPeriodArray(section.periods);

    // Kiểm tra xem section này có bất kỳ xung đột nào với lịch hiện tại không
    const conflicts = checkConflictWithSchedule(section, scheduledClasses);
    let hasAnyConflict = conflicts.length > 0;

    // Nếu là lớp LT và có allSections, kiểm tra xem có lớp TH nào khả dụng không
    if (!section.isPractical && allSections) {
      const practicalSections = allSections.filter(
        (s) => s.courseCode === section.courseCode && s.isPractical && s.classCode.startsWith(section.classCode + ".")
      );

      // Nếu có lớp TH, check xem có ít nhất 1 lớp TH nào không bị conflict không
      if (practicalSections.length > 0) {
        const hasValidPractical = practicalSections.some(
          (ps) => checkConflictWithSchedule(ps, scheduledClasses).length === 0
        );

        // Nếu không có TH nào khả dụng, đánh dấu LT này là conflict
        if (!hasValidPractical) {
          hasAnyConflict = true;
        }
      }
    }

    for (const period of periods) {
      const slotId = `${section.dayOfWeek}-${period}`;

      if (!slotMap.has(slotId)) {
        slotMap.set(slotId, {
          slot: {
            id: slotId,
            dayOfWeek: section.dayOfWeek,
            period,
          },
          availableSections: [],
          hasConflict: false,
        });
      }

      const slot = slotMap.get(slotId)!;

      if (hasAnyConflict) {
        // Nếu section có xung đột, đánh dấu slot này là có xung đột (để hiển thị màu đỏ)
        slot.hasConflict = true;
      } else {
        // Nếu không có xung đột, thêm vào danh sách các lớp khả dụng cho slot này
        slot.availableSections.push(section);
      }
    }
  }

  // Quan trọng: Nếu một slot vừa có lớp khả dụng vừa có conflict (do nhiều section khác nhau),
  // thì ưu tiên hiển thị là có lớp khả dụng (hasConflict = false để có thể click)
  for (const slot of Array.from(slotMap.values())) {
    if (slot.availableSections.length > 0) {
      slot.hasConflict = false;
    }
  }

  return Array.from(slotMap.values());
}

/**
 * Lấy các ClassSection có thể thả vào một slot cụ thể
 * @param slot - TimeSlot muốn kiểm tra
 * @param sections - Các ClassSection có sẵn
 * @param scheduledClasses - Danh sách lớp đã xếp
 * @returns Danh sách ClassSection có thể thả
 */
export function getAvailableSectionsForSlot(
  slot: TimeSlot,
  sections: ClassSection[],
  scheduledClasses: ScheduledClass[]
): ClassSection[] {
  return sections.filter((section) => {
    // Bỏ qua section có thứ hoặc tiết linh hoạt
    if (section.isFlexibleDay || section.isFlexiblePeriod) {
      return false;
    }

    // Kiểm tra section có bao phủ slot này không
    if (section.dayOfWeek !== slot.dayOfWeek) {
      return false;
    }

    const periods = getPeriodArray(section.periods);
    if (!periods.includes(slot.period)) {
      return false;
    }

    // Kiểm tra không conflict
    const conflicts = checkConflictWithSchedule(section, scheduledClasses);
    return conflicts.length === 0;
  });
}

/**
 * Convert periods string thành array of numbers
 * Periods luôn ở dạng comma-separated sau khi parse: "1,2,3,4,5" hoặc "10,11,12"
 * @param periods - Chuỗi tiết (ví dụ: "1,2,3,4,5" hoặc "10,11,12")
 * @returns Array of period numbers
 */
export function getPeriodArray(periods: string): number[] {
  // Nếu là linh hoạt, return empty array
  if (periods === "*") {
    return [];
  }

  // Tất cả periods đều ở dạng comma-separated
  return periods
    .split(",")
    .map((s) => parseInt(s.trim()))
    .filter((n) => !isNaN(n) && n > 0);
}

/**
 * Lấy thời gian bắt đầu và kết thúc của một ClassSection
 */
export function getClassTimeRange(section: ClassSection): { start: number; end: number } {
  return {
    start: section.startPeriod,
    end: section.startPeriod + section.periodCount - 1,
  };
}

/**
 * Tính tổng số tín chỉ đã đăng ký
 * @param scheduledClasses - Danh sách lớp đã xếp
 * @returns Tổng số tín chỉ
 */
export function getTotalCredits(scheduledClasses: ScheduledClass[]): number {
  const courseCredits = new Map<string, number>();

  scheduledClasses.forEach((sc) => {
    const key = sc.classSection.courseCode;
    if (!courseCredits.has(key) || sc.classSection.credits > courseCredits.get(key)!) {
      courseCredits.set(key, sc.classSection.credits);
    }
  });

  return Array.from(courseCredits.values()).reduce((sum, credits) => sum + credits, 0);
}

/**
 * Lấy danh sách môn học unique từ scheduled classes
 */
export function getRegisteredCourses(scheduledClasses: ScheduledClass[]): string[] {
  const courses = new Set<string>();
  scheduledClasses.forEach((sc) => courses.add(sc.classSection.courseCode));
  return Array.from(courses);
}

/**
 * Kiểm tra một ngày có nằm trong khoảng học của section không
 */
export function isDateInSection(date: Date, section: ClassSection): boolean {
  if (!section.startDate || !section.endDate) {
    return true; // Nếu không có thông tin ngày, coi như luôn áp dụng
  }

  return isWithinInterval(date, {
    start: section.startDate,
    end: section.endDate,
  });
}

/**
 * Group sections theo giờ học (cùng thứ và tiết)
 */
export function groupSectionsByTime(sections: ClassSection[]): Map<string, ClassSection[]> {
  const groups = new Map<string, ClassSection[]>();

  sections.forEach((section) => {
    const key = `${section.dayOfWeek}-${section.periods}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(section);
  });

  return groups;
}
