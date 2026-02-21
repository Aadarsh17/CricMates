/**
 * Route group layouts can cause manifest collisions on Vercel.
 * Neutralized this file.
 */
export default function RedundantLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
