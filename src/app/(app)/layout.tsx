'use client';

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Home,
  LogOut as LogOutIcon,
  Menu,
  BarChart,
  Trophy,
  PlusCircle,
  Users,
  ArrowLeft,
  MoreVertical,
  Medal,
  Sigma,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { AppProvider } from "@/context/AppContext";
import { FirebaseClientProvider } from "@/firebase";
import { ClientOnly } from "@/components/ClientOnly";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMatchCenterOpen, setMatchCenterOpen] = useState(true);
  const [isLeagueOpen, setLeagueOpen] = useState(true);
  const [isGamesOpen, setGamesOpen] = useState(true);

  return (
    <FirebaseClientProvider>
      <AppProvider>
        <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
          <div className="hidden border-r bg-muted/40 md:block print:hidden">
            <div className="flex h-full max-h-screen flex-col gap-2">
              <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                <Link
                  href="/"
                  className="flex items-center gap-2 font-semibold"
                >
                  <Image src="/logo.svg" alt="CricMates Logo" width={24} height={24} />
                  <span className="font-headline">CricMates</span>
                </Link>
              </div>
              <div className="flex-1">
                <ClientOnly fallback={
                  <div className="grid items-start px-2 text-sm font-medium lg:px-4 space-y-2 py-2">
                    <Skeleton className="h-8 rounded-lg" />
                    <Skeleton className="h-8 rounded-lg" />
                    <Skeleton className="h-8 rounded-lg" />
                    <Skeleton className="h-8 rounded-lg" />
                  </div>
                }>
                  <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                    <Link
                      href="/home"
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
                    >
                      <Home className="h-4 w-4" />
                      Home
                    </Link>

                    <Collapsible open={isMatchCenterOpen} onOpenChange={setMatchCenterOpen} className="space-y-1">
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                          <div className="flex items-center gap-3">
                              <BarChart className="h-4 w-4" />
                              <span>Match Center</span>
                          </div>
                          <ChevronRight className={`h-4 w-4 transition-transform ${isMatchCenterOpen ? 'rotate-90' : ''}`} />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-7 space-y-1">
                          <Link href="/matches/new" className="block rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                              New Match
                          </Link>
                          <Link href="/matches" className="block rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                              Match History
                          </Link>
                      </CollapsibleContent>
                    </Collapsible>
                    
                    <Collapsible open={isLeagueOpen} onOpenChange={setLeagueOpen} className="space-y-1">
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                          <div className="flex items-center gap-3">
                              <Trophy className="h-4 w-4" />
                              <span>League Central</span>
                          </div>
                          <ChevronRight className={`h-4 w-4 transition-transform ${isLeagueOpen ? 'rotate-90' : ''}`} />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-7 space-y-1">
                          <Link href="/teams" className="block rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                              Teams
                          </Link>
                          <Link href="/points-table" className="block rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                              Points Table
                          </Link>
                          <Link href="/player-stats" className="block rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                              Player Stats
                          </Link>
                          <Link href="/rankings" className="block rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                              Rankings
                          </Link>
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible open={isGamesOpen} onOpenChange={setGamesOpen} className="space-y-1">
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                          <div className="flex items-center gap-3">
                              <Sigma className="h-4 w-4" />
                              <span>Games</span>
                          </div>
                          <ChevronRight className={`h-4 w-4 transition-transform ${isGamesOpen ? 'rotate-90' : ''}`} />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-7 space-y-1">
                           <Link href="/number-game" className="block rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary">
                              Number Game
                          </Link>
                      </CollapsibleContent>
                    </Collapsible>
                  </nav>
                </ClientOnly>
              </div>
            </div>
          </div>
          <div className="flex flex-col">
            <ClientOnly fallback={<Skeleton className="h-14 w-full border-b lg:h-[60px]" />}>
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
                    <SheetHeader>
                      <SheetTitle>
                        <Link
                          href="/"
                          className="flex items-center gap-2 text-lg font-semibold"
                        >
                          <Image src="/logo.svg" alt="CricMates Logo" width={24} height={24} />
                          <span className="font-headline">CricMates</span>
                        </Link>
                      </SheetTitle>
                    </SheetHeader>
                    <nav className="grid gap-2 text-lg font-medium">
                        <Link href="/home" className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground">
                            <Home className="h-5 w-5" />
                            Home
                        </Link>

                        <Collapsible open={isMatchCenterOpen} onOpenChange={setMatchCenterOpen} className="space-y-1">
                            <CollapsibleTrigger className="mx-[-0.65rem] flex w-full items-center justify-between rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground text-lg font-medium">
                                <div className="flex items-center gap-4">
                                    <BarChart className="h-5 w-5" />
                                    <span>Match Center</span>
                                </div>
                                <ChevronRight className={`h-5 w-5 transition-transform ${isMatchCenterOpen ? 'rotate-90' : ''}`} />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pl-12 space-y-1">
                                <Link href="/matches/new" className="block rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground">
                                    New Match
                                </Link>
                                <Link href="/matches" className="block rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground">
                                    Match History
                                </Link>
                            </CollapsibleContent>
                        </Collapsible>
                        
                        <Collapsible open={isLeagueOpen} onOpenChange={setLeagueOpen} className="space-y-1">
                            <CollapsibleTrigger className="mx-[-0.65rem] flex w-full items-center justify-between rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground text-lg font-medium">
                                <div className="flex items-center gap-4">
                                    <Trophy className="h-5 w-5" />
                                    <span>League Central</span>
                                </div>
                                <ChevronRight className={`h-5 w-5 transition-transform ${isLeagueOpen ? 'rotate-90' : ''}`} />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pl-12 space-y-1">
                                <Link href="/teams" className="block rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground">
                                    Teams
                                </Link>
                                <Link href="/points-table" className="block rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground">
                                    Points Table
                                </Link>
                                <Link href="/player-stats" className="block rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground">
                                    Player Stats
                                </Link>
                                <Link href="/rankings" className="block rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground">
                                    Rankings
                                </Link>
                            </CollapsibleContent>
                        </Collapsible>

                        <Collapsible open={isGamesOpen} onOpenChange={setGamesOpen} className="space-y-1">
                            <CollapsibleTrigger className="mx-[-0.65rem] flex w-full items-center justify-between rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground text-lg font-medium">
                                <div className="flex items-center gap-4">
                                    <Sigma className="h-5 w-5" />
                                    <span>Games</span>
                                </div>
                                <ChevronRight className={`h-5 w-5 transition-transform ${isGamesOpen ? 'rotate-90' : ''}`} />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pl-12 space-y-1">
                                <Link href="/number-game" className="block rounded-lg px-3 py-2 text-muted-foreground hover:text-foreground">
                                    Number Game
                                </Link>
                            </CollapsibleContent>
                        </Collapsible>
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
                      variant="ghost"
                      size="icon"
                    >
                      <MoreVertical className="h-5 w-5" />
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
            <main className="flex flex-1 flex-col gap-4 p-2 sm:p-4 lg:gap-6 lg:p-6 bg-background print:bg-transparent print:p-0 print:gap-0">
              {children}
            </main>
          </div>
        </div>
      </AppProvider>
    </FirebaseClientProvider>
  );
}
