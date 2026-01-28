'use client';

import { useState, useEffect } from 'react';

/**
 * Renders children only on the client-side, after the component has mounted.
 * This is useful for wrapping components that cause hydration errors.
 * @param fallback - A temporary element to show during server-side rendering and initial client-side render.
 */
export function ClientOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return fallback;
  }

  return <>{children}</>;
}
