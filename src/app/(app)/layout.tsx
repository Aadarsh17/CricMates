import { AppLayoutClient } from "@/components/layout/AppLayoutClient";

/**
 * AppLayout is now a Server Component to improve build stability on Vercel
 * and prevent route group manifest generation errors.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppLayoutClient>
      {children}
    </AppLayoutClient>
  );
}
