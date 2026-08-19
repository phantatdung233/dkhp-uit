#!/usr/bin/env node

/**
 * Excel-to-JSON Converter for UIT Schedule (TKB)
 * ================================================
 * Chuyển đổi file Excel thời khóa biểu UIT sang định dạng JSON.
 *
 * Usage:
 *   node scripts/excel-to-json.js <input.xlsx> [output.json]
 *   node scripts/excel-to-json.js public/samples/sample-2026-2027.xlsx
 *
 * Supported formats: .xlsx, .xlsm
 *
 * Edge cases handled:
 *   - SĨ SỐ format: "40(0)" → siso=40, dadk=0
 *   - TIẾT multi-digit: "121314" → (12,13,14), "67890" → (6,7,8,9,10)
 *   - Multi-day schedule: THỨ="3, 5", TIẾT="45, 123" → "T3 (4,5), T5 (1,2,3)"
 *   - Cách tuần: CÁCH TUẦN=2 → " — 2 tuần/lần"
 *   - Flexible schedule: HTGD=HT2 → tghoc="HT2"
 *   - No schedule (ĐA/KLTN/TTTN): tghoc=null, giangvien=null when empty
 *   - malop_lythuyet: inferred for TH classes from matching LT class codes
 *   - Date format: "2026-09-07" → "07/09/2026"
 *   - Header differences between TKB LT (TỐ TC, TÊN GIẢNG VIÊN) and TKB TH (SỐ TC, TÊN TRỢ GIẢNG)
 *   - Empty/null/undefined values gracefully handled
 */

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// ============================================================================
// Constants
// ============================================================================

/** Row index (0-based) where the header is located in the Excel file */
const HEADER_ROW_INDEX = 7; // Row 8 in Excel (1-based)

/** Column name aliases for header matching across LT and TH sheets */
const COLUMN_ALIASES = {
  mamh: ["MÃ MH"],
  malop: ["MÃ LỚP"],
  tenmh: ["TÊN MÔN HỌC"],
  magv: ["MÃ GIẢNG VIÊN", "MÃ GV"],
  giangvien: ["TÊN GIẢNG VIÊN", "TÊN TRỢ GIẢNG"],
  siso: ["SĨ SỐ"],
  sotc: ["SỐ TC", "TỐ TC", "TC"],
  thuchanh: ["THỰC HÀNH", "TH"],
  htgd: ["HTGD"],
  thu: ["THỨ"],
  tiet: ["TIẾT"],
  cachTuan: ["CÁCH TUẦN"],
  phongHoc: ["PHÒNG HỌC"],
  khoaHoc: ["KHOÁ HỌC", "KHOA HỌC"],
  hocKy: ["HỌC KỲ"],
  namHoc: ["NĂM HỌC"],
  heDT: ["HỆ ĐT"],
  khoaQL: ["KHOA QL"],
  nbd: ["NBD", "NGÀY BẮT ĐẦU"],
  nkt: ["NKT", "NGÀY KẾT THÚC"],
  ghiChu: ["GHI CHÚ", "GHICHU"],
  ngonNgu: ["NGON NGU", "NGÔN NGỮ"],
  daDK: ["Đã ĐK", "ĐÃ ĐK"],
};

/** HTGD values that indicate no fixed schedule (tghoc = null) */
const NO_SCHEDULE_HTGD = ["ĐA", "KLTN", "TTTN"];

/** HTGD values that represent flexible/hybrid schedules */
const FLEXIBLE_HTGD_PATTERN = /^HT\d*$/i;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get a trimmed string value, returning empty string for null/undefined.
 */
function getString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Get a numeric value, returning null for non-numeric/empty values.
 */
function getNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

/**
 * Find a column value from a row using alias matching.
 * Tries exact match first, then substring match.
 * @param {Object} row - The row object with uppercase keys
 * @param {string} aliasKey - Key from COLUMN_ALIASES
 * @returns {*} The value found, or undefined
 */
function getCol(row, aliasKey) {
  const aliases = COLUMN_ALIASES[aliasKey];
  if (!aliases) return undefined;

  const upperAliases = aliases.map((a) => a.toUpperCase());

  // Exact match first
  for (const alias of upperAliases) {
    if (row[alias] !== undefined) return row[alias];
  }

  // Substring match (fallback for slight header variations)
  const keys = Object.keys(row);
  for (const alias of upperAliases) {
    const found = keys.find(
      (k) =>
        k.includes(alias) &&
        // Avoid TH matching THỨ
        !(alias === "TH" && k === "THỨ")
    );
    if (found !== undefined) return row[found];
  }

  return undefined;
}

/**
 * Parse SĨ SỐ format: "40(0)" → { siso: 40, dadk: 0 }
 * Also handles: "40" → { siso: 40, dadk: 0 }
 *               "" → { siso: null, dadk: null }
 */
function parseSiSo(value) {
  const str = getString(value);
  if (!str) return { siso: null, dadk: null };

  // Match pattern like "40(5)" or "100(23)"
  const match = str.match(/^(\d+)\s*\((\d+)\)$/);
  if (match) {
    return {
      siso: parseInt(match[1], 10),
      dadk: parseInt(match[2], 10),
    };
  }

  // Plain number (no parentheses)
  const num = parseInt(str, 10);
  if (!isNaN(num)) {
    return { siso: num, dadk: 0 };
  }

  return { siso: null, dadk: null };
}

/**
 * Parse TIẾT string into array of period numbers.
 *
 * Handles:
 *   - "123"      → [1, 2, 3]
 *   - "678"      → [6, 7, 8]
 *   - "67890"    → [6, 7, 8, 9, 10]  (0 → 10)
 *   - "12345"    → [1, 2, 3, 4, 5]
 *   - "121314"   → [12, 13, 14]       (2-digit periods)
 *   - "11121314" → [11, 12, 13, 14]
 *   - "1,2,3"    → [1, 2, 3]          (comma-separated)
 *   - ""         → []
 *
 * Logic for continuous digit strings:
 *   - If all digits are 1-9 (no '0' except as part of '10'):
 *     check if it can be a sequence of 2-digit numbers (all ≥10)
 *     otherwise treat each character as a single period
 *   - A trailing '0' means '10' (e.g., "890" → [8,9,10])
 */
function parseTiet(value) {
  const str = getString(value);
  if (!str) return [];

  // Already comma-separated
  if (str.includes(",")) {
    return str
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
  }

  // Pure digit string - need smart parsing
  if (/^\d+$/.test(str)) {
    return parseDigitPeriods(str);
  }

  // Fallback: try to parse as number
  const n = parseInt(str, 10);
  if (!isNaN(n) && n > 0) return [n];

  return [];
}

/**
 * Smart parser for continuous digit period strings.
 *
 * Strategy:
 *   1. Check if the string can be evenly split into 2-digit numbers that are all ≥10
 *      (e.g., "121314" → [12,13,14])
 *   2. Otherwise, parse character-by-character where '0' = 10
 *      (e.g., "12345" → [1,2,3,4,5], "67890" → [6,7,8,9,10])
 */
function parseDigitPeriods(str) {
  // Try 2-digit parsing first if string length is even and ≥ 2
  if (str.length >= 2 && str.length % 2 === 0) {
    const twoDigit = [];
    let valid = true;
    for (let i = 0; i < str.length; i += 2) {
      const num = parseInt(str.substring(i, i + 2), 10);
      if (num >= 10 && num <= 15) {
        twoDigit.push(num);
      } else {
        valid = false;
        break;
      }
    }
    if (valid && twoDigit.length > 0) {
      // Verify it's a reasonable sequence (consecutive or close)
      const isConsecutive = twoDigit.every(
        (v, i) => i === 0 || v === twoDigit[i - 1] + 1
      );
      if (isConsecutive) {
        return twoDigit;
      }
    }
  }

  // Character-by-character parsing: '0' → 10
  return str.split("").map((ch) => (ch === "0" ? 10 : parseInt(ch, 10)));
}

/**
 * Format periods array to human-readable string: [1,2,3] → "1,2,3"
 */
function formatPeriods(periods) {
  return periods.join(",");
}

/**
 * Parse THỨ and TIẾT columns to build tghoc string.
 *
 * Cases:
 *   1. Both empty + HTGD is ĐA/KLTN/TTTN → null (no schedule)
 *   2. Both empty + HTGD is HT2/HT1 → "HT2"/"HT1" (flexible)
 *   3. Single day: THỨ="2", TIẾT="123" → "T2 (1,2,3)"
 *   4. Multi-day: THỨ="3, 5", TIẾT="45, 123" → "T3 (4,5), T5 (1,2,3)"
 *   5. With cách tuần: append " — 2 tuần/lần" when CÁCH TUẦN=2
 */
function buildTghoc(thu, tiet, cachTuan, htgd) {
  const thuStr = getString(thu);
  const tietStr = getString(tiet);
  const htgdStr = getString(htgd).toUpperCase();
  const cachTuanNum = getNumber(cachTuan);

  // No THỨ and no TIẾT
  if (!thuStr && !tietStr) {
    // Check if it's a flexible schedule type
    if (FLEXIBLE_HTGD_PATTERN.test(htgdStr)) {
      return htgdStr; // "HT2", "HT1", etc.
    }
    // No schedule (ĐA, KLTN, TTTN, or genuinely empty)
    return null;
  }

  // Multi-day: THỨ="3, 5", TIẾT="45, 123"
  const thuParts = thuStr.split(",").map((s) => s.trim()).filter(Boolean);
  const tietParts = tietStr.split(",").map((s) => s.trim()).filter(Boolean);

  // If multi-day with matching TIẾT parts
  if (thuParts.length > 1) {
    // Try to match each THỨ with its corresponding TIẾT part
    // TIẾT parts may be comma-separated within the split, so we need to
    // group them properly based on the number of THỨ values
    const tietGroups = groupTietByThu(tietStr, thuParts.length);

    const parts = [];
    for (let i = 0; i < thuParts.length; i++) {
      const dayNum = thuParts[i];
      const periods = tietGroups[i] || [];
      if (periods.length > 0) {
        parts.push(`T${dayNum} (${formatPeriods(periods)})`);
      }
    }

    let result = parts.join(", ");
    if (cachTuanNum === 2) {
      result += " — 2 tuần/lần";
    }
    return result || null;
  }

  // Single day
  const dayNum = thuStr;
  const periods = parseTiet(tietStr);

  if (!dayNum && periods.length === 0) return null;

  let result = "";
  if (dayNum && periods.length > 0) {
    result = `T${dayNum} (${formatPeriods(periods)})`;
  } else if (dayNum) {
    result = `T${dayNum}`;
  } else if (periods.length > 0) {
    result = `(${formatPeriods(periods)})`;
  }

  if (cachTuanNum === 2) {
    result += " — 2 tuần/lần";
  }

  return result || null;
}

/**
 * Group TIẾT string for multi-day schedules.
 *
 * Input: tietStr="45, 123" or "11121314, 2345", numDays=2
 * For "45, 123": → [[4,5], [1,2,3]]
 * For "11121314, 2345": → [[11,12,13,14], [2,3,4,5]]
 *
 * Strategy: Split by ", " first (with space), then parse each part.
 * If that doesn't give enough groups, split by "," and try to
 * distribute periods evenly.
 */
function groupTietByThu(tietStr, numDays) {
  // Try splitting by ", " (with space) first - this is the common separator
  // between day groups in the Excel data
  let parts = tietStr.split(/,\s+/);

  if (parts.length === numDays) {
    return parts.map((part) => parseTiet(part));
  }

  // If comma-space split didn't work, try splitting by just comma
  // and distributing evenly
  parts = tietStr.split(",").map((s) => s.trim());
  if (parts.length === numDays) {
    return parts.map((part) => parseTiet(part));
  }

  // Fallback: parse all periods and try to split evenly
  const allPeriods = parseTiet(tietStr);
  const perGroup = Math.ceil(allPeriods.length / numDays);
  const groups = [];
  for (let i = 0; i < numDays; i++) {
    groups.push(allPeriods.slice(i * perGroup, (i + 1) * perGroup));
  }
  return groups;
}

/**
 * Convert date from various formats to "dd/MM/yyyy".
 *
 * Handles:
 *   - "2026-09-07" → "07/09/2026"
 *   - "07/09/2026" → "07/09/2026" (already correct)
 *   - Excel serial date numbers
 *   - Date objects
 *   - null/empty → null
 */
function formatDate(value) {
  if (value === null || value === undefined || value === "") return null;

  // Excel serial date number
  if (typeof value === "number") {
    const date = excelSerialToDate(value);
    return formatDateObj(date);
  }

  // Date object
  if (value instanceof Date) {
    return formatDateObj(value);
  }

  const str = getString(value);
  if (!str) return null;

  // ISO format: "2026-09-07"
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  // Already in dd/MM/yyyy format
  const dmyMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) {
    return str;
  }

  // Try to parse as Date
  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    return formatDateObj(date);
  }

  return null;
}

/**
 * Convert Excel serial date to JS Date.
 */
function excelSerialToDate(serial) {
  // Excel epoch is January 1, 1900 (with the Lotus 1-2-3 bug for Feb 29, 1900)
  const utcDays = Math.floor(serial) - 25569; // 25569 = days from 1900-01-01 to 1970-01-01
  return new Date(utcDays * 86400000);
}

/**
 * Format a Date object to "dd/MM/yyyy".
 */
function formatDateObj(date) {
  if (!date || isNaN(date.getTime())) return null;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Infer malop_lythuyet (theory class code) for a practical class.
 *
 * Convention: practical class "CE212.R11.1" → theory class "CE212.R11"
 * For deeper nesting like "CE118.R11.VMTN.1" → try "CE118.R11.VMTN" first,
 * then "CE118.R11" if not found in LT classes.
 *
 * @param {string} malop - The practical class code
 * @param {Set<string>} ltClassCodes - Set of all theory class codes from TKB LT
 * @returns {string|null}
 */
function inferMalopLythuyet(malop, ltClassCodes) {
  if (!malop) return null;

  // Try removing trailing .N (numeric suffix)
  const parts = malop.split(".");
  if (parts.length < 3) return null; // e.g., "CE212.R11" has no suffix to remove

  // Try progressively shorter prefixes
  // E.g., "CE212.R11.CLC.1" → try "CE212.R11.CLC", then "CE212.R11"
  for (let i = parts.length - 1; i >= 2; i--) {
    const candidate = parts.slice(0, i).join(".");
    if (ltClassCodes.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

// ============================================================================
// Main Conversion Logic
// ============================================================================

/**
 * Parse a single sheet into an array of course objects.
 *
 * @param {XLSX.WorkSheet} sheet - The worksheet to parse
 * @param {boolean} isPracticalSheet - Whether this is the TKB TH sheet
 * @returns {Object[]} Array of parsed course objects
 */
function parseSheet(sheet, isPracticalSheet) {
  const json = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    range: HEADER_ROW_INDEX,
  });

  if (!json.length) return [];

  // Normalize all keys to uppercase for consistent matching
  const normalized = json.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k.trim().toUpperCase(), v])
    )
  );

  const courses = [];
  const skipped = [];

  for (let i = 0; i < normalized.length; i++) {
    const row = normalized[i];
    const rowNum = HEADER_ROW_INDEX + 2 + i; // Excel row number (1-based)

    try {
      const malop = getString(getCol(row, "malop"));
      const tenmh = getString(getCol(row, "tenmh"));

      // Skip empty rows
      if (!malop && !tenmh) continue;

      if (!malop) {
        skipped.push({ row: rowNum, reason: "Thiếu MÃ LỚP" });
        continue;
      }

      const mamh = getString(getCol(row, "mamh")) || malop.split(".")[0];
      const { siso, dadk } = parseSiSo(getCol(row, "siso"));
      const sotc = getNumber(getCol(row, "sotc"));
      const thuchanh = isPracticalSheet
        ? 1
        : getNumber(getCol(row, "thuchanh")) === 1
          ? 1
          : 0;

      const thu = getCol(row, "thu");
      const tiet = getCol(row, "tiet");
      const cachTuan = getCol(row, "cachTuan");
      const htgd = getCol(row, "htgd");

      const tghoc = buildTghoc(thu, tiet, cachTuan, htgd);

      const giangvienStr = getString(getCol(row, "giangvien"));
      const giangvien = giangvienStr || null;

      const nbd = formatDate(getCol(row, "nbd"));
      const nkt = formatDate(getCol(row, "nkt"));

      courses.push({
        malop,
        mamh,
        tenmh: tenmh || "",
        sotc: sotc !== null ? sotc : 0,
        siso: siso !== null ? siso : 0,
        dadk: dadk !== null ? dadk : 0,
        thuchanh,
        malop_lythuyet: null, // Will be filled later for TH classes
        ngaybatdau: nbd,
        ngayketthuc: nkt,
        giangvien,
        tghoc,
        // Extra metadata (not in JSON output but useful for processing)
        _isPracticalSheet: isPracticalSheet,
        _htgd: getString(htgd),
        _rowNum: rowNum,
      });
    } catch (err) {
      skipped.push({ row: rowNum, reason: err.message });
    }
  }

  if (skipped.length > 0) {
    console.warn(
      `  ⚠ ${skipped.length} dòng bị bỏ qua:`,
      skipped.slice(0, 5).map((s) => `Row ${s.row}: ${s.reason}`).join("; ")
    );
    if (skipped.length > 5) {
      console.warn(`    ... và ${skipped.length - 5} dòng khác`);
    }
  }

  return courses;
}

/**
 * Convert an Excel workbook to JSON format.
 *
 * @param {string} inputPath - Path to the Excel file
 * @returns {Object} The JSON output object
 */
function convertExcelToJson(inputPath) {
  console.log(`📖 Đọc file: ${inputPath}`);

  const wb = XLSX.readFile(inputPath);
  console.log(`📋 Tìm thấy ${wb.SheetNames.length} sheet: ${wb.SheetNames.join(", ")}`);

  const allCourses = [];
  const ltClassCodes = new Set();

  // Process each sheet
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const isPracticalSheet = sheetName.toUpperCase().includes("TKB TH") ||
                              sheetName.toUpperCase().includes("TH");

    console.log(`\n📄 Xử lý sheet: "${sheetName}" (${isPracticalSheet ? "Thực hành" : "Lý thuyết"})`);

    const courses = parseSheet(sheet, isPracticalSheet);
    console.log(`  ✅ ${courses.length} lớp học phần`);

    // Collect LT class codes for malop_lythuyet inference
    if (!isPracticalSheet) {
      courses.forEach((c) => ltClassCodes.add(c.malop));
    }

    allCourses.push(...courses);
  }

  // Fill malop_lythuyet for TH classes
  let linkedCount = 0;
  for (const course of allCourses) {
    if (course._isPracticalSheet) {
      const linked = inferMalopLythuyet(course.malop, ltClassCodes);
      course.malop_lythuyet = linked;
      if (linked) linkedCount++;
    }
  }
  console.log(`\n🔗 Liên kết ${linkedCount} lớp TH với lớp LT tương ứng`);

  // Remove internal metadata fields
  const cleanCourses = allCourses.map((c) => {
    const { _isPracticalSheet, _htgd, _rowNum, ...clean } = c;
    return clean;
  });

  // Build final output
  const output = {
    courses: cleanCourses,
    user_courses: [],
    message: "Lấy danh sách đăng ký thành công",
    status: 1,
  };

  return output;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║         Excel-to-JSON Converter for UIT Schedule (TKB)         ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Usage:                                                          ║
║    node scripts/excel-to-json.js <input.xlsx> [output.json]      ║
║                                                                  ║
║  Arguments:                                                      ║
║    input.xlsx    Path to the Excel schedule file (.xlsx/.xlsm)   ║
║    output.json   (Optional) Path for JSON output                 ║
║                  Default: <input_name>.json in same directory    ║
║                                                                  ║
║  Examples:                                                       ║
║    node scripts/excel-to-json.js tkb.xlsx                        ║
║    node scripts/excel-to-json.js tkb.xlsx output/schedule.json   ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
    `.trim());
    process.exit(0);
  }

  const inputPath = path.resolve(args[0]);

  // Validate input file
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ File không tồn tại: ${inputPath}`);
    process.exit(1);
  }

  const ext = path.extname(inputPath).toLowerCase();
  if (![".xlsx", ".xlsm"].includes(ext)) {
    console.error(`❌ Định dạng file không hỗ trợ: ${ext}. Chỉ hỗ trợ .xlsx và .xlsm`);
    process.exit(1);
  }

  // Determine output path
  const outputPath = args[1]
    ? path.resolve(args[1])
    : inputPath.replace(/\.(xlsx|xlsm)$/i, ".json");

  console.log("═".repeat(60));
  console.log("  Excel → JSON Converter for UIT Schedule");
  console.log("═".repeat(60));

  try {
    const result = convertExcelToJson(inputPath);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write JSON output with pretty formatting
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 4), "utf-8");

    console.log("\n" + "═".repeat(60));
    console.log(`✅ Chuyển đổi thành công!`);
    console.log(`📊 Tổng số lớp: ${result.courses.length}`);
    console.log(`📁 Output: ${outputPath}`);
    console.log(`📏 File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
    console.log("═".repeat(60));
  } catch (err) {
    console.error(`\n❌ Lỗi: ${err.message}`);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = { convertExcelToJson, parseTiet, parseSiSo, buildTghoc, formatDate };

// Run CLI if executed directly
if (require.main === module) {
  main();
}
