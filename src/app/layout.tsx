
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase";
import { AppProvider } from "@/context/AppContext";
import { MainLayoutWrapper } from "@/components/layout/MainLayoutWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "CricMates - ScoresTracker",
  description: "The ultimate app for tracking cricket scores and stats.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning={true}>
        <FirebaseClientProvider>
          <AppProvider>
            <MainLayoutWrapper>
              {children}
            </MainLayoutWrapper>
          </AppProvider>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
