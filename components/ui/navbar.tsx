'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Menu,
  X
} from 'lucide-react';
import { getUserAccountType } from '@/lib/auth';
import { useSmoothNavigation } from '@/lib/navigation';
import Logo from './logo';

interface NavbarProps {
  onToggle?: (open: boolean) => void;
}

export default function Navbar({ onToggle }: NavbarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [accountType, setAccountType] = useState<'admin' | 'employee' | null>(null);
  const [accountTypeLoaded, setAccountTypeLoaded] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { navigate } = useSmoothNavigation();

  useEffect(() => {
    // Check if mobile on mount and resize
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024; // lg breakpoint
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        const saved = localStorage.getItem('sidebarOpen');
        if (saved !== null) {
          setSidebarOpen(saved === 'true');
        }
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const type = await getUserAccountType();
        setAccountType(type);
      }
      setAccountTypeLoaded(true);
    };
    getUser();
  }, [supabase]);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const effectiveAccountType: 'admin' | 'employee' = (accountTypeLoaded
    ? (accountType || 'admin')
    : (pathname?.startsWith('/dashboard/employee') ? 'employee' : 'admin')) as 'admin' | 'employee';

  const navItems = effectiveAccountType === 'employee' 
    ? [
        { name: 'Dashboard', href: '/dashboard/employee', icon: LayoutDashboard },
        { name: 'Submit Claim', href: '/dashboard/claims/new', icon: FileText },
        { name: 'My Wallet', href: '/dashboard/employee/wallet', icon: Wallet },
      ]
    : [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Employees', href: '/dashboard/employees', icon: Users },
        { name: 'Claims', href: '/dashboard/claims', icon: FileText },
        { name: 'Settings', href: '/dashboard/settings', icon: Settings },
      ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/signin');
  };

  const handleToggle = () => {
    if (isMobile) {
      setMobileMenuOpen(!mobileMenuOpen);
    } else {
      const newState = !sidebarOpen;
      setSidebarOpen(newState);
      if (onToggle) onToggle(newState);
      localStorage.setItem('sidebarOpen', newState.toString());
    }
  };

  // Mobile hamburger button
  if (isMobile) {
    return (
      <>
        {/* Mobile Header */}
        <div className="fixed top-0 left-0 right-0 h-16 bg-white/5 backdrop-blur-sm border-b border-white/10 z-50 flex items-center justify-between px-4 lg:hidden">
          <button
            onClick={() => navigate(effectiveAccountType === 'employee' ? '/dashboard/employee' : '/dashboard')}
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
          >
            <Logo size="sm" />
            <span className="text-lg font-bold text-white">Reimburse.me</span>
          </button>
          <button
            onClick={handleToggle}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                onClick={() => setMobileMenuOpen(false)}
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="fixed left-0 top-0 h-screen w-64 bg-white/5 backdrop-blur-lg border-r border-white/10 z-50 flex flex-col lg:hidden"
              >
                {/* Mobile Menu Content */}
                <div className="flex items-center justify-between h-16 px-4 border-b border-white/10 mt-16">
                  <div className="flex items-center space-x-2">
                    <Logo size="sm" />
                    <span className="text-lg font-bold text-white">Menu</span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                  {accountTypeLoaded && navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                    return (
                      <button
                        key={item.name}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          navigate(item.href);
                        }}
                        className={`w-full flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? 'bg-purple-600 text-white'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Icon className={`h-5 w-5 mr-3 flex-shrink-0 ${
                          isActive ? 'text-white' : 'text-slate-300'
                        }`} />
                        <span>{item.name}</span>
                      </button>
                    );
                  })}
                </nav>

                {user && (
                  <div className="border-t border-white/10 p-4">
                    <div className="space-y-2">
                      <div className="px-3 py-2">
                        <p className="text-xs text-slate-400 mb-1">Signed in as</p>
                        <p className="text-sm font-medium text-white truncate">{user.email}</p>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <LogOut className="h-5 w-5 mr-3" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Desktop Sidebar
  return (
    <motion.aside
      initial={false}
      animate={{
        width: sidebarOpen ? 256 : 80,
      }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="hidden lg:flex fixed left-0 top-0 h-screen bg-white/5 border-r border-white/10 z-50 flex-col"
    >
        {/* Logo and Toggle */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          <AnimatePresence mode="wait">
            {sidebarOpen ? (
              <motion.div
                key="logo-open"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex items-center space-x-2 overflow-hidden"
              >
                <button
                  onClick={() => navigate(effectiveAccountType === 'employee' ? '/dashboard/employee' : '/dashboard')}
                  className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
                >
                  <Logo size="sm" />
                  <span className="text-lg font-bold text-white whitespace-nowrap">Reimburse.me</span>
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="logo-closed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-center w-full"
              >
                <button
                  onClick={() => navigate(effectiveAccountType === 'employee' ? '/dashboard/employee' : '/dashboard')}
                  className="hover:opacity-80 transition-opacity"
                >
                  <Logo size="sm" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={handleToggle}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {accountTypeLoaded && navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <button
                key={item.name}
                onClick={() => navigate(item.href)}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative focus:outline-none focus:ring-0 active:outline-none ${
                  isActive
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
                title={sidebarOpen ? '' : item.name}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 transition-colors ${
                  isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
                } ${sidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                        {item.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {!sidebarOpen && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
                      {item.name}
                    </div>
                  )}
                </button>
            );
          })}
        </nav>

        {/* User Section */}
        {user && (
          <div className="border-t border-white/10 p-4">
            {sidebarOpen ? (
              <div className="space-y-2">
                <div className="px-3 py-2">
                  <p className="text-xs text-slate-400 mb-1">Signed in as</p>
                  <p className="text-sm font-medium text-white truncate">{user.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        )}
      </motion.aside>
  );
}
