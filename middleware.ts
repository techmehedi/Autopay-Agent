import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protect dashboard routes
  if (req.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/auth/signin', req.url));
    }
    
    // Check if user has account type set
    if (session.user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('account_type')
        .eq('id', session.user.id)
        .single();
      
      if (!profile || !profile.account_type) {
        // Redirect to account type selection if not set
        return NextResponse.redirect(new URL('/auth/select-account-type', req.url));
      }
    }
  }

  // Redirect authenticated users away from auth pages (except select-account-type)
  if (req.nextUrl.pathname.startsWith('/auth') && session) {
    // Allow access to select-account-type if no account type is set
    if (req.nextUrl.pathname === '/auth/select-account-type') {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('account_type')
        .eq('id', session.user.id)
        .single();
      
      if (profile && profile.account_type) {
        // User already has account type, redirect to dashboard
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
      // User doesn't have account type, allow access
      return res;
    }
    
    // Redirect other auth pages to dashboard
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/auth/:path*'],
};

