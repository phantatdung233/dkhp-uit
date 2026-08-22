import { isWithinInterval, areIntervalsOverlapping } from "date-fns";
import type { ClassSection, Conflict, TimeSlot, HighlightedSlot, ScheduledClass } from "@/types";

// Bộ nhớ đệm (Cache) và bảng tra nhanh trong phạm vi module
const periodCache = new Map<string, number[]>();
const conflictMemo = new Map<string, Conflict | null>();
const scheduleIndexCache = new WeakMap<ScheduledClass[], Map<string, ScheduledClass[]>>();

function periodsKey(periods: string) {
  return periods ?? "";
}

/**
 * Phân tích và cache danh sách các tiết học dạng mảng số nguyên đã sắp xếp.
 */
function cachedGetPeriodArray(periods: string): number[] {
  const k = periodsKey(periods);
  const cached = periodCache.get(k);
  if (cached) return cached;
  if (!periods || periods === "*") {
    periodCache.set(k, []);
    return [];
  }
  const arr = periods
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n > 0);
  const uniqSorted = Array.from(new Set(arr)).sort((a, b) => a - b);
  periodCache.set(k, uniqSorted);
  return uniqSorted;
}

function makeSlotKey(day: number | null, period: number) {
  return `${day}-${period}`;
}

function datesOverlapIfDefined(a: ClassSection, b: ClassSection) {
  if (a.startDate && a.endDate && b.startDate && b.endDate) {
    return areIntervalsOverlapping({ start: a.startDate, end: a.endDate }, { start: b.startDate, end: b.endDate });
  }
  return true;
}

function memoize(key: string, value: Conflict | null) {
  conflictMemo.set(key, value);
  return value;
}

/**
 * Kiểm tra xem 2 lớp học phần có bị xung đột thời gian (thứ, tiết, ngày học) hay không.
 * Sử dụng memoization để tăng tốc độ kiểm tra lặp lại.
 */
export function checkConflict(section1: ClassSection, section2: ClassSection): Conflict | null {
  const id1 = section1.id;
  const id2 = section2.id;
  const pairKey = id1 < id2 ? `${id1}|${id2}` : `${id2}|${id1}`;
  if (conflictMemo.has(pairKey)) return conflictMemo.get(pairKey)!;

  // Bỏ qua nếu cùng 1 lớp hoặc có lịch học linh hoạt
  if (id1 === id2) return memoize(pairKey, null);
  if (section1.isFlexibleDay || section2.isFlexibleDay) return memoize(pairKey, null);
  if (section1.isFlexiblePeriod || section2.isFlexiblePeriod) return memoize(pairKey, null);
  if (section1.dayOfWeek !== section2.dayOfWeek) return memoize(pairKey, null);

  const p1 = cachedGetPeriodArray(section1.periods);
  const p2 = cachedGetPeriodArray(section2.periods);
  if (p1.length === 0 || p2.length === 0) return memoize(pairKey, null);

  const [small, big] = p1.length <= p2.length ? [p1, new Set(p2)] : [p2, new Set(p1)];
  const overlapping: number[] = [];
  for (const x of small) {
    if (big.has(x)) overlapping.push(x);
  }
  if (overlapping.length === 0) return memoize(pairKey, null);

  if (!datesOverlapIfDefined(section1, section2)) return memoize(pairKey, null);

  const conflictingSlots: TimeSlot[] = overlapping.map((period) => ({
    id: `${section1.dayOfWeek}-${period}`,
    dayOfWeek: section1.dayOfWeek!,
    period,
  }));

  const conflict: Conflict = {
    id: `conflict-${section1.id}-${section2.id}`,
    type: "time_overlap",
    message: `Trùng ${overlapping.length} tiết vào Thứ ${section1.dayOfWeek}`,
    conflictingClasses: [section1, section2],
    conflictingSlots,
  };

  return memoize(pairKey, conflict);
}

/**
 * Xây dựng bảng tra cứu nhanh theo ô `Thứ-Tiết` từ danh sách lớp đã xếp lịch.
 */
function buildScheduleIndex(scheduledClasses: ScheduledClass[]): Map<string, ScheduledClass[]> {
  const cached = scheduleIndexCache.get(scheduledClasses);
  if (cached) return cached;

  const idx = new Map<string, ScheduledClass[]>();
  for (const sc of scheduledClasses) {
    const s = sc.classSection;
    if (s.isFlexibleDay || s.isFlexiblePeriod || s.dayOfWeek == null) continue;
    const periods = cachedGetPeriodArray(s.periods);
    for (const p of periods) {
      const k = makeSlotKey(s.dayOfWeek, p);
      const arr = idx.get(k);
      if (arr) arr.push(sc);
      else idx.set(k, [sc]);
    }
  }
  scheduleIndexCache.set(scheduledClasses, idx);
  return idx;
}

/**
 * Kiểm tra xem một lớp học phần mới có bị xung đột với các lớp đã xếp lịch hay không.
 */
export function checkConflictWithSchedule(newSection: ClassSection, scheduledClasses: ScheduledClass[]): Conflict[] {
  if (newSection.isFlexibleDay || newSection.isFlexiblePeriod || newSection.dayOfWeek == null) return [];

  const idx = buildScheduleIndex(scheduledClasses);
  const periods = cachedGetPeriodArray(newSection.periods);
  if (periods.length === 0) return [];

  const found = new Map<string, Conflict>();
  for (const p of periods) {
    const key = makeSlotKey(newSection.dayOfWeek, p);
    const candidates = idx.get(key);
    if (!candidates) continue;
    for (const cand of candidates) {
      const c = checkConflict(newSection, cand.classSection);
      if (c) found.set(c.id, c);
    }
  }
  return Array.from(found.values());
}

/**
 * Kiểm tra xem môn học đã đăng ký có thiếu lớp lý thuyết hoặc thực hành đi kèm hay không.
 */
export function checkMissingPairedClass(
  section: ClassSection,
  scheduledClasses: ScheduledClass[],
  allSections: ClassSection[]
): Conflict | null {
  const sameCourse = allSections.filter((s) => s.courseCode === section.courseCode);
  const hasPractical = sameCourse.some((s) => s.isPractical);
  const hasTheory = sameCourse.some((s) => !s.isPractical);
  if (!hasPractical || !hasTheory) return null;

  const registered = scheduledClasses
    .filter((sc) => sc.classSection.courseCode === section.courseCode)
    .map((sc) => sc.classSection);

  const hasRegPractical = registered.some((s) => s.isPractical);
  const hasRegTheory = registered.some((s) => !s.isPractical);

  if (section.isPractical && !hasRegTheory) {
    return {
      id: `missing-theory-${section.id}`,
      type: "missing_theory",
      message: `Bạn cần đăng ký thêm lớp LÝ THUYẾT cho môn "${section.courseName}"`,
      conflictingClasses: [section],
      conflictingSlots: [],
    };
  }

  if (!section.isPractical && !hasRegPractical) {
    const validPracticalCodes = sameCourse
      .filter(
        (s) => s.isPractical && s.classCode && section.classCode && s.classCode.startsWith(section.classCode + ".")
      )
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
 * Tính toán danh sách các ô thời gian cần highlight khi người dùng chọn môn học hoặc kéo thả lớp.
 */
export function getHighlightedSlots(
  sections: ClassSection[],
  scheduledClasses: ScheduledClass[],
  allSections?: ClassSection[]
): HighlightedSlot[] {
  const slotMap = new Map<string, HighlightedSlot>();
  const idx = buildScheduleIndex(scheduledClasses);

  const practicalsByCourse = new Map<string, ClassSection[]>();
  if (allSections) {
    for (const s of allSections) {
      if (!s.isPractical) continue;
      const arr = practicalsByCourse.get(s.courseCode) || [];
      arr.push(s);
      practicalsByCourse.set(s.courseCode, arr);
    }
  }

  for (const section of sections) {
    if (section.isFlexibleDay || section.isFlexiblePeriod || section.dayOfWeek == null) continue;
    const periods = cachedGetPeriodArray(section.periods);
    if (periods.length === 0) continue;

    let hasAnyConflict = false;
    for (const p of periods) {
      const key = makeSlotKey(section.dayOfWeek, p);
      const cands = idx.get(key);
      if (!cands) continue;
      for (const sc of cands) {
        if (checkConflict(section, sc.classSection)) {
          hasAnyConflict = true;
          break;
        }
      }
      if (hasAnyConflict) break;
    }

    // Nếu là lớp LT, kiểm tra tính khả dụng của các lớp TH đi kèm
    if (!hasAnyConflict && !section.isPractical && allSections) {
      const courseHasPractical = practicalsByCourse.has(section.courseCode);
      if (courseHasPractical) {
        const practicals = practicalsByCourse
          .get(section.courseCode)!
          .filter((ps) => ps.classCode && section.classCode && ps.classCode.startsWith(section.classCode + "."));
        if (practicals.length === 0) {
          hasAnyConflict = true;
        } else {
          const allPracticalsAvailable = practicals.every((ps) => {
            if (ps.isFlexibleDay || ps.isFlexiblePeriod || ps.dayOfWeek == null) return true;
            const periods = cachedGetPeriodArray(ps.periods);
            if (periods.length === 0) return true;

            for (const p of periods) {
              const k = makeSlotKey(ps.dayOfWeek, p);
              const cands = idx.get(k) || [];
              if (cands.some((sc) => checkConflict(ps, sc.classSection))) {
                return false;
              }
            }
            return true;
          });

          if (!allPracticalsAvailable) hasAnyConflict = true;
        }
      }
    }

    for (const period of periods) {
      const slotId = makeSlotKey(section.dayOfWeek, period);
      if (!slotMap.has(slotId)) {
        slotMap.set(slotId, {
          slot: { id: slotId, dayOfWeek: section.dayOfWeek, period },
          availableSections: [],
          conflictingSections: [],
          hasConflict: false,
        });
      }
      const slot = slotMap.get(slotId)!;
      if (hasAnyConflict) {
        slot.hasConflict = true;
        if (!slot.conflictingSections) slot.conflictingSections = [];
        if (!slot.conflictingSections.some((s) => s.id === section.id)) {
          slot.conflictingSections.push(section);
        }
      } else {
        if (!slot.availableSections.some((s) => s.id === section.id)) {
          slot.availableSections.push(section);
        }
      }
    }
  }

  for (const s of slotMap.values()) {
    if (s.availableSections.length > 0) s.hasConflict = false;
  }

  return Array.from(slotMap.values());
}

/**
 * Lấy danh sách các lớp học phần có thể xếp vào ô thời gian chỉ định mà không bị trùng lịch.
 */
export function getAvailableSectionsForSlot(
  slot: TimeSlot,
  sections: ClassSection[],
  scheduledClasses: ScheduledClass[]
): ClassSection[] {
  const idx = buildScheduleIndex(scheduledClasses);
  const period = slot.period;
  const day = slot.dayOfWeek;
  const candidates = sections.filter(
    (s) =>
      !s.isFlexibleDay && !s.isFlexiblePeriod && s.dayOfWeek === day && cachedGetPeriodArray(s.periods).includes(period)
  );

  const scheduledInSlot = idx.get(makeSlotKey(day, period)) || [];
  return candidates.filter((section) => {
    for (const sc of scheduledInSlot) {
      if (checkConflict(section, sc.classSection)) return false;
    }
    return true;
  });
}

export function getPeriodArray(periods: string): number[] {
  return cachedGetPeriodArray(periods);
}

export function getClassTimeRange(section: ClassSection): { start: number; end: number } {
  return { start: section.startPeriod, end: section.startPeriod + section.periodCount - 1 };
}

/**
 * Tính tổng số tín chỉ của danh sách lớp đã xếp lịch.
 */
export function getTotalCredits(scheduledClasses: ScheduledClass[]): number {
  return scheduledClasses.reduce((sum, sc) => sum + (sc.classSection.credits || 0), 0);
}

/**
 * Lấy danh sách các mã môn học đã có trong lịch.
 */
export function getRegisteredCourses(scheduledClasses: ScheduledClass[]): string[] {
  const set = new Set<string>();
  for (const sc of scheduledClasses) set.add(sc.classSection.courseCode);
  return Array.from(set);
}

export function isDateInSection(date: Date, section: ClassSection): boolean {
  if (!section.startDate || !section.endDate) return true;
  return isWithinInterval(date, { start: section.startDate, end: section.endDate });
}

export function groupSectionsByTime(sections: ClassSection[]): Map<string, ClassSection[]> {
  const map = new Map<string, ClassSection[]>();
  for (const s of sections) {
    const key = `${s.dayOfWeek}-${s.periods}`;
    const arr = map.get(key) || [];
    arr.push(s);
    map.set(key, arr);
  }
  return map;
}

