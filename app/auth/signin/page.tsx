'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import Link from 'next/link';
import { getUserAccountType } from '@/lib/auth';
import Logo from '@/components/ui/logo';
import { motion } from 'framer-motion';

export default function SignInPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // Check auth state and redirect if already authenticated
    const checkAuthAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // User is authenticated, check account type
        const accountType = await getUserAccountType();
        if (!accountType) {
          // No account type, redirect to selection
          router.push('/auth/select-account-type');
        } else {
          // Has account type, redirect to dashboard
          router.push('/dashboard');
        }
      } else {
        setCheckingAuth(false);
      }
    };

    checkAuthAndRedirect();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_UP') {
        if (session) {
          // Wait a bit for the session to be fully established
          setTimeout(async () => {
            const accountType = await getUserAccountType();
            if (!accountType) {
              router.push('/auth/select-account-type');
            } else {
              router.push('/dashboard');
            }
          }, 500);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  if (checkingAuth) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"
      >
        <div className="text-center">
          <motion.div
            animate={{
              rotate: [0, 360],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear"
            }}
            className="mb-8 flex justify-center"
          >
            <Logo size="lg" />
          </motion.div>
          <div className="flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-purple-400 rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4"
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <Logo size="lg" />
            </Link>
            <Link href="/" className="hover:opacity-80 transition-opacity">
              <h1 className="text-4xl font-bold text-white">Reimburse.me</h1>
            </Link>
          </div>
          <p className="text-slate-300">AI-powered employee reimbursement</p>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#3b82f6', // blue-500 - better contrast
                    brandAccent: '#2563eb', // blue-600 - hover state
                    brandButtonText: 'white',
                    defaultButtonBackground: '#3b82f6', // blue-500
                    defaultButtonBackgroundHover: '#2563eb', // blue-600
                    defaultButtonBorder: '#3b82f6',
                    defaultButtonText: 'white',
                    dividerBackground: 'rgba(255, 255, 255, 0.1)',
                    inputBackground: 'rgba(255, 255, 255, 0.05)',
                    inputBorder: 'rgba(255, 255, 255, 0.1)',
                    inputBorderHover: 'rgba(255, 255, 255, 0.2)',
                    inputBorderFocus: '#3b82f6', // blue-500 for focus
                    inputText: 'white',
                    inputLabelText: 'rgba(255, 255, 255, 0.7)',
                    inputPlaceholder: 'rgba(255, 255, 255, 0.5)',
                    messageText: 'rgba(255, 255, 255, 0.9)',
                    messageTextDanger: '#ef4444',
                    anchorTextColor: 'white', // white for better visibility
                    anchorTextHoverColor: 'rgba(255, 255, 255, 0.8)', // slightly faded on hover
                  },
                  space: {
                    spaceSmall: '4px',
                    spaceMedium: '8px',
                    spaceLarge: '16px',
                    labelBottomMargin: '8px',
                    anchorBottomMargin: '4px',
                    emailInputSpacing: '4px',
                    socialAuthSpacing: '4px',
                    buttonPadding: '10px 15px',
                    inputPadding: '10px 15px',
                  },
                  fontSizes: {
                    baseBodySize: '13px',
                    baseInputSize: '14px',
                    baseLabelSize: '14px',
                    baseButtonSize: '14px',
                  },
                  fonts: {
                    bodyFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
                    buttonFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
                    inputFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
                    labelFontFamily: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
                  },
                  borderWidths: {
                    buttonBorderWidth: '0px',
                    inputBorderWidth: '1px',
                  },
                  radii: {
                    borderRadiusButton: '8px',
                    buttonBorderRadius: '8px',
                    inputBorderRadius: '8px',
                    labelBorderRadius: '8px',
                  },
                },
              },
            }}
            providers={['google', 'github']}
            redirectTo={`${window.location.origin}/auth/callback`}
            theme="dark"
          />
        </div>
        <p className="text-center text-slate-400 mt-6 text-sm">
          By signing in, you agree to our{' '}
          <Link href="/terms" className="text-purple-400 hover:underline">
            Terms of Service
          </Link>
        </p>
      </div>
    </motion.div>
  );
}

