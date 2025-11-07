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
  Wallet
} from 'lucide-react';
import { getUserAccountType } from '@/lib/auth';
import Logo from './logo';

interface NavbarProps {
  onToggle?: (open: boolean) => void;
}

export default function Navbar({ onToggle }: NavbarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [accountType, setAccountType] = useState<'admin' | 'employee' | null>(null);
  const [accountTypeLoaded, setAccountTypeLoaded] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const saved = localStorage.getItem('sidebarOpen');
    if (saved !== null) {
      setSidebarOpen(saved === 'true');
    }

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

  return (
    <motion.aside
      initial={false}
      animate={{
        width: sidebarOpen ? 256 : 80,
      }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-screen bg-white/5 border-r border-white/10 z-50 flex flex-col"
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
                <Link href={effectiveAccountType === 'employee' ? '/dashboard/employee' : '/dashboard'} className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                  <Logo size="sm" />
                  <span className="text-lg font-bold text-white whitespace-nowrap">Reimburse.me</span>
                </Link>
              </motion.div>
            ) : (
              <motion.div
                key="logo-closed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-center w-full"
              >
                <Link href={effectiveAccountType === 'employee' ? '/dashboard/employee' : '/dashboard'} className="hover:opacity-80 transition-opacity">
                  <Logo size="sm" />
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => {
              const newState = !sidebarOpen;
              setSidebarOpen(newState);
              if (onToggle) onToggle(newState);
              localStorage.setItem('sidebarOpen', newState.toString());
            }}
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
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative focus:outline-none focus:ring-0 active:outline-none ${
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
              </Link>
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
