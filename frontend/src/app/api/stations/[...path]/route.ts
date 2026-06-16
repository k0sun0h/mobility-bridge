import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://blinking-item-process.ngrok-free.dev";

interface RouteContext {
  params: Promise<{
    path?: string[];
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const backendPath = path.map((part) => encodeURIComponent(part)).join("/");
  const url = `${API_BASE}/api/stations/${backendPath}${request.nextUrl.search}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "ngrok-skip-browser-warning": "69420",
      },
    });
    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "역 정보를 불러올 수 없습니다.",
        data: null,
        meta: {},
        error: {
          code: "STATION_PROXY_ERROR",
          detail: "백엔드 역 정보 API 연결에 실패했습니다.",
        },
      },
      { status: 502 }
    );
  }
}
