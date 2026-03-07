
import type { Metadata } from 'next';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import Navbar from '@/components/layout/Navbar';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';

export const metadata: Metadata = {
  title: 'CricMates - Professional Cricket Scoring',
  description: 'Manage leagues, scores, and players with ease.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.PreactNode | React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground min-h-screen" suppressHydrationWarning>
        <FirebaseClientProvider>
          <AppProvider>
            <div className="flex flex-col min-h-screen">
              <Navbar />
              {/* Added pt-20 to prevent navbar overlap */}
              <main className="flex-1 container mx-auto px-4 py-6 pt-20">
                {children}
              </main>
            </div>
            <Toaster />
          </AppProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
