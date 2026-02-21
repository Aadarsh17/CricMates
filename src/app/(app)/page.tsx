'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * This page is converted to a Client Component to force manifest generation on Vercel.
 * It resolves the route collision with src/app/page.tsx by immediately redirecting.
 */
export default function AppPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to root welcome page or home dashboard
    router.replace('/');
  }, [router]);

  return null;
}
