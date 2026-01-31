'use client';
import { FirebaseClientProvider } from "@/firebase";

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FirebaseClientProvider>
        <div className="bg-background dark:bg-muted/20 min-h-screen">
            <main className="container mx-auto py-4 sm:py-6 lg:py-8">
                {children}
            </main>
        </div>
    </FirebaseClientProvider>
  );
}
