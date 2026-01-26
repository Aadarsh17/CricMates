'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Home,
  LogOut as LogOutIcon,
  Menu,
  BarChart,
  Trophy,
  PlusCircle,
  Users,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { AppProvider } from "@/context/AppContext";
import { FirebaseClientProvider } from "@/firebase";
import { ClientOnly } from "@/components/ClientOnly";

const HeaderPlaceholder = () => (
  <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 print:hidden" />
);

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const userAvatar = PlaceHolderImages.find((img) => img.id === "user-avatar");
  const router = useRouter();
  const pathname = usePathname();

  return (
    <FirebaseClientProvider>
      <AppProvider>
        <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
          <div className="hidden border-r bg-muted/40 md:block print:hidden">
            <div className="flex h-full max-h-screen flex-col gap-2">
              <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                <Link
                  href="/home"
                  className="flex items-center gap-2 font-semibold"
                >
                  <Image src="/logo.svg" alt="CricMates Logo" width={24} height={24} />
                  <span className="font-headline">CricMates</span>
                </Link>
              </div>
              <div className="flex-1">
                <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                  <Link
                    href="/home"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
                  >
                    <Home className="h-4 w-4" />
                    Home
                  </Link>
                  <Link
                    href="/teams"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
                  >
                    <Users className="h-4 w-4" />
                    Teams
                  </Link>
                  <Link
                    href="/matches/new"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
                  >
                    <PlusCircle className="h-4 w-4" />
                    New Match
                  </Link>
                  <Link
                    href="/matches"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
                  >
                    <BarChart className="h-4 w-4" />
                    Match History
                  </Link>
                  <Link
                    href="/points-table"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
                  >
                    <Trophy className="h-4 w-4" />
                    Points Table
                  </Link>
                  <Link
                    href="/player-stats"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
                  >
                    <Users className="h-4 w-4" />
                    Player Stats
                  </Link>
                </nav>
              </div>
            </div>
          </div>
          <div className="flex flex-col">
             <ClientOnly fallback={<HeaderPlaceholder />}>
              <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 print:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0 md:hidden"
                    >
                      <Menu className="h-5 w-5" />
                      <span className="sr-only">Toggle navigation menu</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="flex flex-col">
                    <nav className="grid gap-2 text-lg font-medium">
                      <Link
                        href="/home"
                        className="flex items-center gap-2 text-lg font-semibold mb-4"
                      >
                        <Image src="/logo.svg" alt="CricMates Logo" width={24} height={24} />
                        <span className="font-headline">CricMates</span>
                      </Link>
                      <Link
                        href="/home"
                        className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                      >
                        <Home className="h-5 w-5" />
                        Home
                      </Link>
                      <Link
                        href="/teams"
                        className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                      >
                        <Users className="h-5 w-5" />
                        Teams
                      </Link>
                      <Link
                        href="/matches/new"
                        className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                      >
                        <PlusCircle className="h-5 w-5" />
                        New Match
                      </Link>
                      <Link
                        href="/matches"
                        className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                      >
                        <BarChart className="h-5 w-5" />
                        Match History
                      </Link>
                      <Link
                        href="/points-table"
                        className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                      >
                        <Trophy className="h-5 w-5" />
                        Points Table
                      </Link>
                      <Link
                        href="/player-stats"
                        className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                      >
                        <Users className="h-5 w-5" />
                        Player Stats
                      </Link>
                    </nav>
                  </SheetContent>
                </Sheet>
                {pathname !== '/home' && (
                  <Button variant="outline" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back</span>
                  </Button>
                )}
                <div className="w-full flex-1">
                  {/* Can add a search bar here later */}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="rounded-full"
                    >
                      <Avatar>
                        {userAvatar && (
                          <AvatarImage
                            src={userAvatar.imageUrl}
                            alt="User"
                            data-ai-hint={userAvatar.imageHint}
                          />
                        )}
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                      <span className="sr-only">Toggle user menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Settings</DropdownMenuItem>
                    <DropdownMenuItem>Support</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <LogOutIcon className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </header>
            </ClientOnly>
            <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-background print:bg-transparent print:p-0 print:gap-0">
              {children}
            </main>
          </div>
        </div>
      </AppProvider>
    </FirebaseClientProvider>
  );
}
