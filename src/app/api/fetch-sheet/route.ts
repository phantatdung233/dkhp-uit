import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl = body?.url;

    if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập đường link Google Sheet" }, { status: 400 });
    }

    const trimmedUrl = rawUrl.trim();
    let exportUrl = "";

    // Regex to extract Google Sheet ID or published doc ID
    const pubMatch = trimmedUrl.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
    const standardMatch = trimmedUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);

    if (pubMatch) {
      exportUrl = `https://docs.google.com/spreadsheets/d/e/${pubMatch[1]}/pub?output=xlsx`;
    } else if (standardMatch) {
      exportUrl = `https://docs.google.com/spreadsheets/d/${standardMatch[1]}/export?format=xlsx`;
    } else if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmedUrl)) {
      exportUrl = `https://docs.google.com/spreadsheets/d/${trimmedUrl}/export?format=xlsx`;
    } else if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
      // If user provided a direct export URL or similar
      exportUrl = trimmedUrl;
    } else {
      return NextResponse.json(
        {
          error:
            "Đường link Google Sheet không hợp lệ. Vui lòng dán đường link có định dạng https://docs.google.com/spreadsheets/d/...",
        },
        { status: 400 }
      );
    }

    const response = await fetch(exportUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Không tìm thấy bảng tính Google Sheet. Vui lòng kiểm tra lại đường link." },
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          error:
            "Không thể tải Google Sheet (Mã lỗi: " +
            response.status +
            "). Vui lòng đảm bảo bảng tính đã được mở quyền 'Bất kỳ ai có liên kết đều có thể xem'.",
        },
        { status: 400 }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    // If redirected to Google login / permission denied page (HTML content)
    if (contentType.includes("text/html")) {
      return NextResponse.json(
        {
          error:
            "Không thể đọc bảng tính do chưa được chia sẻ công khai. Vui lòng mở quyền chia sẻ: 'Bất kỳ ai có đường liên kết đều có thể xem' (Viewer).",
        },
        { status: 403 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    // Check if empty buffer
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: "File tải về từ Google Sheet rỗng. Vui lòng kiểm tra lại bảng tính." },
        { status: 400 }
      );
    }

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="sheet.xlsx"',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Đã xảy ra lỗi khi tải dữ liệu từ Google Sheet",
      },
      { status: 500 }
    );
  }
}
