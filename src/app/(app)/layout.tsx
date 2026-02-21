/** Removed default export to fix Vercel Parallel Route conflict. Dashboard logic moved to root src/app/layout.tsx and MainLayoutWrapper. */
export function RedundantLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}