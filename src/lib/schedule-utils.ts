import { isWithinInterval, areIntervalsOverlapping } from "date-fns";
import type { ClassSection, Conflict, TimeSlot, HighlightedSlot, ScheduledClass } from "@/types";

/* ---------------------------
   Caches & indexes (module-scope)
   --------------------------- */
const periodCache = new Map<string, number[]>();
const conflictMemo = new Map<string, Conflict | null>();
const scheduleIndexCache = new WeakMap<ScheduledClass[], Map<string, ScheduledClass[]>>();

/* ---------------------------
   Small helpers
   --------------------------- */
function periodsKey(periods: string) {
  return periods ?? "";
}
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
  // if not all defined, keep original behavior: treat as overlapping
  return true;
}

/* ---------------------------
   Optimized checkConflict w/ memo + efficient period intersection
   --------------------------- */
export function checkConflict(section1: ClassSection, section2: ClassSection): Conflict | null {
  // quick equality key to memoize unordered pair
  const id1 = section1.id;
  const id2 = section2.id;
  const pairKey = id1 < id2 ? `${id1}|${id2}` : `${id2}|${id1}`;
  if (conflictMemo.has(pairKey)) return conflictMemo.get(pairKey)!;

  // Early rejects
  if (id1 === id2) return memoize(pairKey, null);
  if (section1.isFlexibleDay || section2.isFlexibleDay) return memoize(pairKey, null);
  if (section1.isFlexiblePeriod || section2.isFlexiblePeriod) return memoize(pairKey, null);
  if (section1.dayOfWeek !== section2.dayOfWeek) return memoize(pairKey, null);

  // periods
  const p1 = cachedGetPeriodArray(section1.periods);
  const p2 = cachedGetPeriodArray(section2.periods);
  if (p1.length === 0 || p2.length === 0) return memoize(pairKey, null); // one is flexible or empty -> no time overlap
  // iterate smaller set
  const [small, big] = p1.length <= p2.length ? [p1, new Set(p2)] : [p2, new Set(p1)];
  const overlapping: number[] = [];
  for (const x of small) {
    if (big.has(x)) overlapping.push(x);
  }
  if (overlapping.length === 0) return memoize(pairKey, null);

  // dates
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

function memoize(key: string, value: Conflict | null) {
  conflictMemo.set(key, value);
  return value;
}

/* ---------------------------
   Schedule index builder: Map<"day-period", ScheduledClass[]>
   Uses WeakMap cache keyed by scheduledClasses array ref
   --------------------------- */
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

/* ---------------------------
   checkConflictWithSchedule: use index to prune candidates
   --------------------------- */
export function checkConflictWithSchedule(newSection: ClassSection, scheduledClasses: ScheduledClass[]): Conflict[] {
  // quick returns
  if (newSection.isFlexibleDay || newSection.isFlexiblePeriod || newSection.dayOfWeek == null) return [];

  const idx = buildScheduleIndex(scheduledClasses);
  const periods = cachedGetPeriodArray(newSection.periods);
  if (periods.length === 0) return []; // flexible / nothing

  const found = new Map<string, Conflict>(); // dedupe by pair id
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

/* ---------------------------
   checkMissingPairedClass: small optimizations (index by course)
   --------------------------- */
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

/* ---------------------------
   getHighlightedSlots: use index + course practical map
   --------------------------- */
export function getHighlightedSlots(
  sections: ClassSection[],
  scheduledClasses: ScheduledClass[],
  allSections?: ClassSection[]
): HighlightedSlot[] {
  const slotMap = new Map<string, HighlightedSlot>();
  const idx = buildScheduleIndex(scheduledClasses);

  // prepare course -> practicals map if needed (one pass)
  const practicalsByCourse = new Map<string, ClassSection[]>();
  if (allSections) {
    for (const s of allSections) {
      if (!s.isPractical) continue;
      const arr = practicalsByCourse.get(s.courseCode) || [];
      arr.push(s);
      practicalsByCourse.set(s.courseCode, arr);
    }
  }

  // iterate candidate sections
  for (const section of sections) {
    if (section.isFlexibleDay || section.isFlexiblePeriod || section.dayOfWeek == null) continue;
    const periods = cachedGetPeriodArray(section.periods);
    if (periods.length === 0) continue;

    // quick conflict check using index: if any scheduled in any of its slots conflicts -> hasAnyConflict = true
    let hasAnyConflict = false;
    for (const p of periods) {
      const key = makeSlotKey(section.dayOfWeek, p);
      const cands = idx.get(key);
      if (!cands) continue;
      // test actual conflict with those candidates
      for (const sc of cands) {
        if (checkConflict(section, sc.classSection)) {
          hasAnyConflict = true;
          break;
        }
      }
      if (hasAnyConflict) break;
    }

    // If LT, check practical availability - TẤT CẢ lớp TH thuộc LT này phải available
    if (!hasAnyConflict && !section.isPractical && allSections) {
      const courseHasPractical = practicalsByCourse.has(section.courseCode);
      if (courseHasPractical) {
        const practicals = practicalsByCourse
          .get(section.courseCode)!
          .filter((ps) => ps.classCode && section.classCode && ps.classCode.startsWith(section.classCode + "."));
        if (practicals.length === 0) {
          hasAnyConflict = true;
        } else {
          // Kiểm tra TẤT CẢ các lớp thực hành phải conflict-free
          // Nếu bất kỳ lớp TH nào bị conflict -> LT này cũng bị conflict
          const allPracticalsAvailable = practicals.every((ps) => {
            // Nếu TH flexible -> coi như available
            if (ps.isFlexibleDay || ps.isFlexiblePeriod || ps.dayOfWeek == null) return true;

            // Kiểm tra TẤT CẢ tiết của TH này
            const periods = cachedGetPeriodArray(ps.periods);
            if (periods.length === 0) return true; // flexible

            // Nếu có BẤT KỲ tiết nào bị conflict -> TH này không available
            for (const p of periods) {
              const k = makeSlotKey(ps.dayOfWeek, p);
              const cands = idx.get(k) || [];
              if (cands.some((sc) => checkConflict(ps, sc.classSection))) {
                return false; // TH này bị conflict
              }
            }
            return true; // TH này available
          });

          if (!allPracticalsAvailable) hasAnyConflict = true;
        }
      }
    }

    // populate slots
    for (const period of periods) {
      const slotId = makeSlotKey(section.dayOfWeek, period);
      if (!slotMap.has(slotId)) {
        slotMap.set(slotId, {
          slot: { id: slotId, dayOfWeek: section.dayOfWeek, period },
          availableSections: [],
          hasConflict: false,
        });
      }
      const slot = slotMap.get(slotId)!;
      if (hasAnyConflict) slot.hasConflict = true;
      else slot.availableSections.push(section);
    }
  }

  // finalize hasConflict: if availableSections > 0 -> false
  for (const s of slotMap.values()) {
    if (s.availableSections.length > 0) s.hasConflict = false;
  }

  return Array.from(slotMap.values());
}

/* ---------------------------
   getAvailableSectionsForSlot: index-based + memo
   --------------------------- */
export function getAvailableSectionsForSlot(
  slot: TimeSlot,
  sections: ClassSection[],
  scheduledClasses: ScheduledClass[]
): ClassSection[] {
  const idx = buildScheduleIndex(scheduledClasses);
  // quick candidates: sections that have same day & include the period
  const period = slot.period;
  const day = slot.dayOfWeek;
  const candidates = sections.filter(
    (s) =>
      !s.isFlexibleDay && !s.isFlexiblePeriod && s.dayOfWeek === day && cachedGetPeriodArray(s.periods).includes(period)
  );

  // now test conflicts only with scheduled classes in that exact slot (prunes a lot)
  const scheduledInSlot = idx.get(makeSlotKey(day, period)) || [];
  return candidates.filter((section) => {
    // if there is any scheduled that conflicts -> not available
    for (const sc of scheduledInSlot) {
      if (checkConflict(section, sc.classSection)) return false;
    }
    return true;
  });
}

/* ---------------------------
   Remaining helpers unchanged (fast)
   --------------------------- */
export function getPeriodArray(periods: string): number[] {
  return cachedGetPeriodArray(periods);
}

export function getClassTimeRange(section: ClassSection): { start: number; end: number } {
  return { start: section.startPeriod, end: section.startPeriod + section.periodCount - 1 };
}

export function getTotalCredits(scheduledClasses: ScheduledClass[]): number {
  const courseCredits = new Map<string, number>();
  for (const sc of scheduledClasses) {
    const key = sc.classSection.courseCode;
    const credits = sc.classSection.credits;
    if (!courseCredits.has(key) || credits > courseCredits.get(key)!) courseCredits.set(key, credits);
  }
  let sum = 0;
  for (const v of courseCredits.values()) sum += v;
  return sum;
}

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
