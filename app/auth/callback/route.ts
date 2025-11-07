import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error('Error exchanging code for session:', exchangeError);
      return NextResponse.redirect(new URL('/auth/signin?error=session_error', requestUrl.origin));
    }
    
    // Small delay to ensure session is fully established
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if user has account type set
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (user && !userError) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('account_type')
        .eq('id', user.id)
        .single();
      
      if (!profile || !profile.account_type) {
        // Redirect to account type selection if not set
        return NextResponse.redirect(new URL('/auth/select-account-type', requestUrl.origin));
      }
    }
  }

  return NextResponse.redirect(new URL('/dashboard', requestUrl.origin));
}

