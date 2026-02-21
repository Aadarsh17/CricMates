'use client';

import { usePathname } from 'next/navigation';
import { AppLayoutClient } from './AppLayoutClient';

/**
 * Handles conditional layout wrapping.
 * Welcome page and Share pages don't get the dashboard sidebar.
 */
export function MainLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname !== '/' && !pathname.startsWith('/share');

  if (!isDashboard) {
    return <>{children}</>;
  }

  return <AppLayoutClient>{children}</AppLayoutClient>;
}
