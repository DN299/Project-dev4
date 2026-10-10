import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const res = NextResponse.next()
  res.headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'http://localhost:5173')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Key')
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: res.headers })
  }
  return res
}

export const config = { matcher: '/api/:path*' }