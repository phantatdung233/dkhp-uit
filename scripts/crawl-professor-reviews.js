/**
 * Script crawl và tổng hợp đánh giá giảng viên từ Everytime API.
 * 
 * Cách chạy:
 *   node scripts/crawl-professor-reviews.js
 * 
 * Hoặc tuỳ chỉnh phạm vi:
 *   node scripts/crawl-professor-reviews.js --start 8455 --end 8752 --delay 200
 */

const fs = require("fs");
const path = require("path");

// ================= Cấu hình mặc định =================
const DEFAULT_CONFIG = {
  url: "https://api.everytime.net/find/course/professor/review/list",
  startId: 8455,
  endId: 8752,
  delayMs: 250, // Thời gian nghỉ giữa các request để tránh bị chặn (ms)
  cookie: "vnsid=s%3ARLpWNiIfxfOJLfo24mEJmIx3SP9cQEQI.jpc2Lj1A9BK9xenBTxoU69igOp3IuM9V39l74kuGPYo",
  outputFile: path.join(__dirname, "../src/data/professor-reviews.json"),
};

// Đọc tham số dòng lệnh nếu có (CLI Args)
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--start" && args[i + 1]) {
      config.startId = parseInt(args[++i], 10);
    } else if (args[i] === "--end" && args[i + 1]) {
      config.endId = parseInt(args[++i], 10);
    } else if (args[i] === "--delay" && args[i + 1]) {
      config.delayMs = parseInt(args[++i], 10);
    } else if (args[i] === "--cookie" && args[i + 1]) {
      config.cookie = args[++i];
    } else if (args[i] === "--output" && args[i + 1]) {
      config.outputFile = path.resolve(args[++i]);
    }
  }

  return config;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Gửi request lấy review cho một professorId
 */
async function fetchProfessorReviews(professorId, cookie) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 (everytimeApp; iOS/8.3.8 (iOS/26.6; iPhone))",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "sec-fetch-site": "same-site",
    "origin": "https://www.everytime.net",
    "sec-fetch-mode": "cors",
    "referer": "https://www.everytime.net/",
    "sec-fetch-dest": "empty",
    "accept-language": "vi-VN,vi;q=0.9",
    "priority": "u=3, i",
    "Cookie": cookie,
  };

  const payload = {
    professorId,
    courseIds: [],
    semesterIds: [],
    ratings: [],
    sort: "id",
  };

  const response = await fetch("https://api.everytime.net/find/course/professor/review/list", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Xử lý và tính toán dữ liệu tổng hợp cho một giảng viên
 */
function processProfessorData(result) {
  if (!result || !result.professor || !result.professor.name) {
    return null;
  }

  const { professor, reviews = [] } = result;

  // Lọc và làm sạch danh sách reviews (bỏ id, courseId, semesterName)
  const cleanReviews = reviews.map((r) => ({
    text: r.text,
    rating: r.rating,
    courseName: r.courseName || "",
  }));

  let ratingSum = 0;
  cleanReviews.forEach((r) => {
    ratingSum += r.rating || 0;
  });

  const totalReviews = cleanReviews.length;
  const averageRating = totalReviews > 0 ? parseFloat((ratingSum / totalReviews).toFixed(2)) : 0;

  return {
    name: professor.name.trim(),
    averageRating,
    totalReviews,
    reviews: cleanReviews,
  };
}

/**
 * Hàm chính thực thi cào dữ liệu
 */
async function main() {
  const config = parseArgs();
  const total = config.endId - config.startId + 1;

  console.log("==================================================");
  console.log("🚀 BẮT ĐẦU CÀO DỮ LIỆU ĐÁNH GIÁ GIẢNG VIÊN EVERYTIME");
  console.log(`📌 Phạm vi ID : ${config.startId} -> ${config.endId} (Tổng: ${total} IDs)`);
  console.log(`⏱️  Thời gian nghỉ: ${config.delayMs}ms/request`);
  console.log(`📁 File kết quả : ${config.outputFile}`);
  console.log("==================================================\n");

  const professors = [];
  let foundCount = 0;
  let totalReviewsCount = 0;
  let errorCount = 0;

  for (let currentId = config.startId; currentId <= config.endId; currentId++) {
    const index = currentId - config.startId + 1;
    const progress = ((index / total) * 100).toFixed(1);

    try {
      const res = await fetchProfessorReviews(currentId, config.cookie);

      if (res && res.status === "success" && res.result) {
        const profData = processProfessorData(res.result);
        if (profData) {
          professors.push(profData);
          foundCount++;
          totalReviewsCount += profData.totalReviews;

          console.log(
            `[${index}/${total}] (${progress}%) ✅ ID ${currentId}: "${profData.name}" - ${profData.totalReviews} reviews (Rating: ${profData.averageRating}⭐)`
          );
        } else {
          console.log(`[${index}/${total}] (${progress}%) ⚪ ID ${currentId}: Không có thông tin giảng viên`);
        }
      } else {
        console.log(`[${index}/${total}] (${progress}%) ⚪ ID ${currentId}: API trả về không thành công`);
      }
    } catch (err) {
      errorCount++;
      console.error(`[${index}/${total}] (${progress}%) ❌ ID ${currentId} Lỗi:`, err.message);
    }

    // Nghỉ giữa các request
    if (currentId < config.endId) {
      await sleep(config.delayMs);
    }
  }

  // Đảm bảo thư mục lưu file tồn tại
  const outDir = path.dirname(config.outputFile);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Cấu trúc output
  const outputData = {
    crawledAt: new Date().toISOString(),
    totalProfessors: professors.length,
    totalReviews: totalReviewsCount,
    professors,
  };

  fs.writeFileSync(config.outputFile, JSON.stringify(outputData, null, 2), "utf-8");

  console.log("\n==================================================");
  console.log("🎉 HOÀN THÀNH CÀO DỮ LIỆU!");
  console.log(`👥 Tổng số giảng viên tìm thấy: ${foundCount}/${total}`);
  console.log(`💬 Tổng số đánh giá thu thập  : ${totalReviewsCount}`);
  console.log(`⚠️  Số ID bị lỗi request      : ${errorCount}`);
  console.log(`💾 Đã lưu vào                : ${config.outputFile}`);
  console.log("==================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
