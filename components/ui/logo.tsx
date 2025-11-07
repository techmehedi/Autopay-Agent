'use client';

import { motion } from 'framer-motion';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  const sizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const iconSizes = {
    sm: 'w-3/5 h-3/5',
    md: 'w-3/4 h-3/4',
    lg: 'w-4/5 h-4/5',
  };

  return (
    <motion.div
      className={`relative ${sizes[size]} ${className}`}
      whileHover={{ 
        scale: 1.15,
        rotateY: [0, -10, 10, 0],
      }}
      transition={{ 
        duration: 0.6,
        ease: 'easeOut'
      }}
      style={{ 
        perspective: '1000px',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* 3D Card Container */}
      <div className="relative w-full h-full">
        {/* Main 3D Card - Receipt/Payment Card */}
        <motion.div
          className="absolute inset-0 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #4f46e5 100%)',
            boxShadow: `
              0 0 0 1px rgba(255, 255, 255, 0.1) inset,
              0 8px 16px rgba(139, 92, 246, 0.3),
              0 4px 8px rgba(0, 0, 0, 0.2),
              -2px -2px 4px rgba(255, 255, 255, 0.1) inset
            `,
            transform: 'perspective(1000px) rotateY(-8deg) rotateX(8deg)',
          }}
          // Removed animated boxShadow to prevent flashing
        >
          {/* Top Shine/Highlight */}
          <div className="absolute top-0 left-0 right-0 h-1/2 rounded-t-xl bg-gradient-to-b from-white/25 via-white/10 to-transparent" />
          
          {/* Bottom Shadow */}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 rounded-b-xl bg-gradient-to-t from-black/20 to-transparent" />
          
          {/* Side Edge Highlights */}
          <div className="absolute left-0 top-0 bottom-0 w-1/4 rounded-l-xl bg-gradient-to-r from-white/15 to-transparent" />
        </motion.div>

        {/* Dollar Sign Icon - Floating Above */}
        <motion.div
          className={`absolute inset-0 flex items-center justify-center ${iconSizes[size]}`}
          animate={{
            y: [0, -2, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-full h-full text-white"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="2" x2="12" y2="22" />
            <path d="M17 5H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6" />
          </svg>
        </motion.div>

        {/* Back Shadow Layer for Depth */}
        <div
          className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-900 to-purple-900 opacity-40 blur-sm"
          style={{
            transform: 'translateZ(-8px) translateY(3px) scale(0.95)',
          }}
        />

        {/* Outer Glow - static to prevent flashing */}
        <div className="absolute -inset-2 rounded-xl bg-purple-500/20 blur-md opacity-30" />
      </div>

      {/* Static Sparkles - removed animation to prevent flashing */}
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full opacity-50"
          style={{
            top: `${15 + i * 25}%`,
            left: `${10 + i * 30}%`,
          }}
        />
      ))}
    </motion.div>
  );
}

