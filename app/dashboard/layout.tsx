'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/ui/navbar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('sidebarOpen');
    if (saved !== null) {
      setSidebarOpen(saved === 'true');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navbar onToggle={setSidebarOpen} />
      <main 
        className="transition-all duration-300 ease-in-out px-4 sm:px-6 lg:px-8 pt-20 lg:pt-8 pb-8"
        style={{ 
          marginLeft: sidebarOpen ? '256px' : '80px'
        }}
      >
        <style jsx global>{`
          @media (max-width: 1023px) {
            main {
              margin-left: 0 !important;
            }
          }
        `}</style>
        {children}
      </main>
    </div>
  );
}
