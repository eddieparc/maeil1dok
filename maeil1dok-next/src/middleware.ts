import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Maintenance mode check — redirect all routes to /maintenance
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true'
  const isMaintenancePage = request.nextUrl.pathname === '/maintenance'
  
  if (isMaintenanceMode && !isMaintenancePage) {
    const url = request.nextUrl.clone()
    url.pathname = '/maintenance'
    return NextResponse.redirect(url)
  }

  // Handle Apple Sign In POST callback — Apple sends POST to /auth/callback
  if (
    request.method === 'POST' &&
    request.nextUrl.pathname === '/auth/callback'
  ) {
    return NextResponse.next()
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
