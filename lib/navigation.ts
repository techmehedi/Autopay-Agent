'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Custom hook for smooth navigation with loading screen
 */
export function useSmoothNavigation() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const navigate = (path: string) => {
    setIsNavigating(true);
    // Small delay for smooth fade-out
    setTimeout(() => {
      router.push(`/loading?redirect=${encodeURIComponent(path)}`);
    }, 200);
  };

  return { navigate, isNavigating };
}

