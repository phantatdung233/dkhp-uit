import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy API hỗ trợ nhà phát triển lấy dữ liệu đánh giá giảng viên theo professorId.
 * Chạy trên server-side để tránh bị chặn CORS từ trình duyệt.
 */

interface ReviewItem {
  id?: number;
  rating: number;
  courseId?: number;
  courseName?: string;
  semesterName?: string;
  text: string;
  isLocked?: boolean;
  posvoteCount?: number;
}

interface EverytimeResponse {
  status: string;
  result?: {
    professor?: {
      id?: number;
      name: string;
      department?: string;
      ratingDistribution?: Record<string, number>;
    };
    reviews?: ReviewItem[];
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const professorId = Number(body?.professorId);
    const cookie = body?.cookie?.trim() || "";

    if (!professorId || isNaN(professorId)) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp professorId hợp lệ (số nguyên)" },
        { status: 400 }
      );
    }

    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 (everytimeApp; iOS/8.3.8 (iOS/26.6; iPhone))",
      Accept: "application/json",
      "Content-Type": "application/json",
      "sec-fetch-site": "same-site",
      origin: "https://www.everytime.net",
      "sec-fetch-mode": "cors",
      referer: "https://www.everytime.net/",
      "sec-fetch-dest": "empty",
      "accept-language": "vi-VN,vi;q=0.9",
      priority: "u=3, i",
    };

    if (cookie) {
      headers["Cookie"] = cookie;
    }

    const payload = {
      professorId,
      courseIds: [],
      semesterIds: [],
      ratings: [],
      sort: "id",
    };

    const response = await fetch(
      "https://api.everytime.net/find/course/professor/review/list",
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Lỗi kết nối máy chủ Everytime (${response.status}: ${response.statusText})`,
        },
        { status: response.status }
      );
    }

    const data: EverytimeResponse = await response.json();

    if (!data.result || !data.result.professor || !data.result.professor.name) {
      return NextResponse.json({
        found: false,
        message: `Không tìm thấy thông tin cho professorId = ${professorId}`,
      });
    }

    const { professor, reviews = [] } = data.result;

    // Lọc bỏ id, courseId, semesterName, posvoteCount, isLocked theo chuẩn của dự án
    const cleanReviews = reviews.map((r) => ({
      rating: r.rating || 0,
      courseName: r.courseName || "",
      text: r.text || "",
    }));

    // Tính rating trung bình
    let averageRating = 0;
    if (cleanReviews.length > 0) {
      const sum = cleanReviews.reduce((acc, cur) => acc + (cur.rating || 0), 0);
      averageRating = parseFloat((sum / cleanReviews.length).toFixed(2));
    }

    const cleanProfessorData = {
      name: professor.name,
      department: professor.department || "",
      averageRating,
      totalReviews: cleanReviews.length,
      reviews: cleanReviews,
    };

    return NextResponse.json({
      found: true,
      data: cleanProfessorData,
    });
  } catch (error) {
    console.error("Lỗi API crawl reviews:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Đã xảy ra lỗi nội bộ",
      },
      { status: 500 }
    );
  }
}
