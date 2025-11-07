'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import Logo from '@/components/ui/logo';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      }
    };
    checkUser();
  }, [router, supabase]);

  const handleGetStarted = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsTransitioning(true);
    
    // Small delay for smooth fade-out, then navigate
    setTimeout(() => {
      router.push('/loading?redirect=/auth/signin');
    }, 300);
  };

  return (
    <AnimatePresence mode="wait">
      {!isTransitioning ? (
        <motion.div
          key="home"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"
        >
      {/* Navigation */}
      <nav className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <Logo size="md" />
            <span className="text-xl sm:text-2xl font-bold text-white">Reimburse.me</span>
          </Link>
          <div className="flex items-center space-x-4 sm:space-x-8">
            <Link
              href="/auth/signin"
              className="text-sm sm:text-base text-white/90 hover:text-white transition-colors font-medium"
            >
              Sign In
            </Link>
            <button
              onClick={handleGetStarted}
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm sm:text-base font-medium shadow-lg shadow-blue-500/30"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-16 sm:pb-32">
        {/* Subtle mountain/background illustration */}
        <div className="absolute bottom-0 left-0 right-0 h-64 opacity-20">
          <svg className="w-full h-full" viewBox="0 0 1200 200" preserveAspectRatio="none">
            <path
              d="M0,200 L200,150 L400,170 L600,120 L800,140 L1000,110 L1200,130 L1200,200 Z"
              fill="url(#mountainGradient)"
              opacity="0.3"
            />
            <defs>
              <linearGradient id="mountainGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center relative z-10"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-serif text-white mb-4 sm:mb-6 leading-tight px-2">
            <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">#1</span>
            <br />
            AI assistant for
            <br />
            <span className="font-bold">reimbursements</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 mb-6 sm:mb-10 max-w-2xl mx-auto font-light px-4">
            Automatically processes claims, enforces policies, and pays employees instantly. 
            Makes you the most efficient finance team.
          </p>
                      <div className="flex items-center justify-center px-4">
                        <button
                          onClick={handleGetStarted}
                          className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all text-base sm:text-lg font-medium shadow-xl shadow-blue-500/40 hover:shadow-2xl hover:shadow-blue-500/50 hover:scale-105"
                        >
                          <Sparkles className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                          Get Started
                          <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      </div>
        </motion.div>
      </div>

                  {/* Embedded UI Mockup Frame */}
                  <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 sm:pb-20">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ 
            opacity: 1, 
            y: [0, -15, 0],
          }}
          transition={{ 
            opacity: { duration: 0.8, delay: 0.3 },
            y: { 
              duration: 4, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: 0.3
            }
          }}
          className="relative group"
          whileHover={{ scale: 1.02 }}
        >
          {/* Outer glow frame */}
          <div className="rounded-3xl p-1 bg-gradient-to-r from-orange-400/30 via-yellow-400/30 to-pink-500/30 shadow-2xl group-hover:from-orange-400/50 group-hover:via-yellow-400/50 group-hover:to-pink-500/50 group-hover:shadow-[0_0_60px_rgba(255,165,0,0.3)] transition-all duration-500">
            {/* Inner frame */}
            <div className="rounded-[22px] bg-gradient-to-r from-orange-500/20 via-yellow-400/20 to-pink-500/20 p-2 group-hover:from-orange-500/30 group-hover:via-yellow-400/30 group-hover:to-pink-500/30 transition-all duration-500">
              {/* Dashboard UI Mockup */}
              <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 overflow-hidden group-hover:shadow-2xl transition-all duration-300">
                {/* Mock window controls */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500/50 hover:bg-red-500 transition-colors cursor-pointer"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/50 hover:bg-yellow-500 transition-colors cursor-pointer"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/50 hover:bg-green-500 transition-colors cursor-pointer"></div>
                </div>

                {/* Mock dashboard content */}
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/30 flex items-center justify-center">
                        <span className="text-purple-300 text-xs font-bold">$</span>
                      </div>
                      <div className="text-white text-sm font-medium">Reimbursements</div>
                    </div>
                    <div className="text-white/60 text-xs">Today</div>
                  </div>

                  {/* Stats cards with real data */}
                  <div className="grid grid-cols-3 gap-4">
                    <motion.div 
                      whileHover={{ scale: 1.05, y: -4 }}
                      className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 hover:border-purple-400/50 transition-all cursor-pointer group"
                    >
                      <div className="text-white/60 text-xs mb-2">Total Claims</div>
                      <div className="text-2xl font-bold text-white mb-1 group-hover:text-purple-300 transition-colors">247</div>
                      <div className="text-white/40 text-xs mb-2">↑ 12% this month</div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '75%' }}
                          transition={{ duration: 1, delay: 0.5 }}
                          className="h-full bg-purple-400/50 rounded-full"
                        ></motion.div>
                      </div>
                    </motion.div>
                    <motion.div 
                      whileHover={{ scale: 1.05, y: -4 }}
                      className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 hover:border-green-400/50 transition-all cursor-pointer group"
                    >
                      <div className="text-white/60 text-xs mb-2">Approved</div>
                      <div className="text-2xl font-bold text-white mb-1 group-hover:text-green-300 transition-colors">$18.5K</div>
                      <div className="text-white/40 text-xs mb-2">↑ 8% this month</div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '82%' }}
                          transition={{ duration: 1, delay: 0.7 }}
                          className="h-full bg-green-400/50 rounded-full"
                        ></motion.div>
                      </div>
                    </motion.div>
                    <motion.div 
                      whileHover={{ scale: 1.05, y: -4 }}
                      className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 hover:border-yellow-400/50 transition-all cursor-pointer group"
                    >
                      <div className="text-white/60 text-xs mb-2">Pending</div>
                      <div className="text-2xl font-bold text-white mb-1 group-hover:text-yellow-300 transition-colors">12</div>
                      <div className="text-white/40 text-xs mb-2">↓ 3 this week</div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '35%' }}
                          transition={{ duration: 1, delay: 0.9 }}
                          className="h-full bg-yellow-400/50 rounded-full"
                        ></motion.div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Table with real data */}
                  <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-white/80 text-sm font-medium">Recent Claims</div>
                      <div className="text-white/40 text-xs">View All →</div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { name: 'Sarah Chen', amount: '$245.50', purpose: 'Team Lunch', status: 'approved', date: '2h ago' },
                        { name: 'Michael Park', amount: '$89.00', purpose: 'Uber Ride', status: 'pending', date: '5h ago' },
                        { name: 'Emily Davis', amount: '$1,200.00', purpose: 'Conference Ticket', status: 'approved', date: '1d ago' },
                        { name: 'James Wilson', amount: '$156.75', purpose: 'Office Supplies', status: 'approved', date: '2d ago' },
                      ].map((claim, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: 1 + i * 0.1 }}
                          whileHover={{ x: 4, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                          className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/10 transition-all cursor-pointer group"
                        >
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-xs font-semibold group-hover:scale-110 transition-transform shadow-lg">
                            {claim.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="flex-1">
                            <div className="text-white text-sm font-medium group-hover:text-purple-300 transition-colors">{claim.name}</div>
                            <div className="text-white/50 text-xs flex items-center gap-2">
                              <span>{claim.purpose}</span>
                              <span>•</span>
                              <span className="font-semibold">{claim.amount}</span>
                              <span>•</span>
                              <span>{claim.date}</span>
                            </div>
                          </div>
                          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                            claim.status === 'approved' 
                              ? 'bg-green-400/20 text-green-300 group-hover:bg-green-400/30 shadow-lg shadow-green-500/20' 
                              : 'bg-yellow-400/20 text-yellow-300 group-hover:bg-yellow-400/30 shadow-lg shadow-yellow-500/20'
                          } transition-all group-hover:scale-105`}>
                            {claim.status}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating elements for visual interest */}
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.4, 0.2]
            }}
            transition={{ 
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute -top-4 -right-4 w-24 h-24 bg-yellow-400/20 rounded-full blur-2xl group-hover:bg-yellow-400/30"
          ></motion.div>
          <motion.div 
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.3, 0.2]
            }}
            transition={{ 
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.5
            }}
            className="absolute -bottom-4 -left-4 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl group-hover:bg-pink-500/30"
          ></motion.div>
        </motion.div>
      </div>
    </motion.div>
      ) : (
        <motion.div
          key="transition"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center"
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
      )}
    </AnimatePresence>
  );
}
