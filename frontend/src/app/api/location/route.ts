// src/app/api/location/route.ts
// Next.js API Route — 서버에서 IP 위치 조회 (CORS 우회)
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // 클라이언트 IP 추출 (프록시 환경 대응)
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : '';

    // ip-api.com: 무료, CORS 없음, 분당 45회 (서버→서버라 충분)
    const url = ip
      ? `http://ip-api.com/json/${ip}?fields=lat,lon,status`
      : `http://ip-api.com/json/?fields=lat,lon,status`;

    const res = await fetch(url, { next: { revalidate: 0 } });
    const data = await res.json();

    if (data.status !== 'success') {
      return NextResponse.json({ error: 'IP 위치 조회 실패' }, { status: 502 });
    }

    return NextResponse.json({ lat: data.lat, lng: data.lon });
  } catch (err) {
    console.error('❌ /api/location 에러:', err);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}