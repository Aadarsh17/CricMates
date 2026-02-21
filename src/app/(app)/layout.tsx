/** Neutralized to fix Vercel Parallel Route conflict. Dashboard logic moved to root src/app/layout.tsx and MainLayoutWrapper. */
export default function RedundantLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}