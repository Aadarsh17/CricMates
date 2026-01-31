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
  TrendingUp,
  PanelLeftClose,
  PanelRightOpen,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { AppProvider } from "@/context/AppContext";
import { FirebaseClientProvider } from "@/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ClientOnly } from "@/components/ClientOnly";


const NavLink = ({ href, icon, label, isCollapsed }: { href: string, icon: React.ReactNode, label: string, isCollapsed: boolean }) => {
  return (
    <TooltipProvider delayDuration={0}>
        <Tooltip>
            <TooltipTrigger asChild>
                 <Link
                    href={href}
                    className={`flex items-center gap-3 rounded-lg py-2 text-muted-foreground transition-all hover:text-primary ${isCollapsed ? 'h-10 w-10 justify-center' : 'px-3'}`}
                  >
                    {icon}
                    <span className={isCollapsed ? 'sr-only' : ''}>{label}</span>
                  </Link>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right"><p>{label}</p></TooltipContent>}
        </Tooltip>
    </TooltipProvider>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <FirebaseClientProvider>
      <AppProvider>
        <div className={`grid min-h-screen w-full transition-[grid-template-columns] duration-300 ease-in-out ${isSidebarCollapsed ? 'md:grid-cols-[72px_1fr]' : 'md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]'}`}>
          <div className="hidden border-r bg-muted/40 md:flex md:flex-col print:hidden">
            <div className="flex h-full max-h-screen flex-col">
              <div className={`flex h-14 items-center border-b lg:h-[60px] ${isSidebarCollapsed ? 'justify-center px-2' : 'px-4 lg:px-6'}`}>
                <Link
                  href="/"
                  className="flex items-center gap-2 font-semibold"
                >
                  <Image src="/logo.svg" alt="CricMates Logo" width={24} height={24} />
                  {!isSidebarCollapsed && <span className="font-headline">CricMates</span>}
                </Link>
              </div>
              <div className="flex-1 overflow-auto py-2">
                  <nav className={`grid items-start text-sm font-medium ${isSidebarCollapsed ? 'px-2 justify-center' : 'px-2 lg:px-4'}`}>
                      <NavLink href="/home" icon={<Home className="h-5 w-5" />} label="Home" isCollapsed={isSidebarCollapsed} />
                      <NavLink href="/teams" icon={<Users className="h-5 w-5" />} label="Teams" isCollapsed={isSidebarCollapsed} />
                      <NavLink href="/matches/new" icon={<PlusCircle className="h-5 w-5" />} label="New Match" isCollapsed={isSidebarCollapsed} />
                      <NavLink href="/matches" icon={<BarChart className="h-5 w-5" />} label="Match History" isCollapsed={isSidebarCollapsed} />
                      <NavLink href="/points-table" icon={<Trophy className="h-5 w-5" />} label="Points Table" isCollapsed={isSidebarCollapsed} />
                      <NavLink href="/player-stats" icon={<Medal className="h-5 w-5" />} label="Player Stats" isCollapsed={isSidebarCollapsed} />
                      <NavLink href="/rankings" icon={<TrendingUp className="h-5 w-5" />} label="Rankings" isCollapsed={isSidebarCollapsed} />
                      <NavLink href="/number-game" icon={<Sigma className="h-5 w-5" />} label="Number Game" isCollapsed={isSidebarCollapsed} />
                  </nav>
              </div>
              <div className="mt-auto border-t p-2">
                  <Button variant="ghost" size="icon" className="w-full" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                      {isSidebarCollapsed ? <PanelRightOpen /> : <PanelLeftClose />}
                      <span className="sr-only">Toggle Sidebar</span>
                  </Button>
              </div>
            </div>
          </div>
          <div className="flex flex-col">
              <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 print:hidden">
                <ClientOnly fallback={<Skeleton className="h-10 w-10 shrink-0 md:hidden" />}>
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
                          <Link href="/teams" className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground">
                              <Users className="h-5 w-5" />
                              Teams
                          </Link>
                          <Link href="/matches/new" className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground">
                              <PlusCircle className="h-5 w-5" />
                              New Match
                          </Link>
                          <Link href="/matches" className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground">
                              <BarChart className="h-5 w-5" />
                              Match History
                          </Link>
                          <Link href="/points-table" className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground">
                              <Trophy className="h-5 w-5" />
                              Points Table
                          </Link>
                          <Link href="/player-stats" className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground">
                              <Medal className="h-5 w-5" />
                              Player Stats
                          </Link>
                          <Link href="/rankings" className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground">
                              <TrendingUp className="h-5 w-5" />
                              Rankings
                          </Link>
                          <Link href="/number-game" className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground">
                              <Sigma className="h-5 w-5" />
                              Number Game
                          </Link>
                      </nav>
                    </SheetContent>
                  </Sheet>
                </ClientOnly>
                {pathname !== '/home' && (
                  <Button variant="outline" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back</span>
                  </Button>
                )}
                <div className="w-full flex-1">
                  {/* Can add a search bar here later */}
                </div>
                <ClientOnly fallback={<Skeleton className="h-10 w-10 rounded-full" />}>
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
                </ClientOnly>
              </header>
            <main className="flex flex-1 flex-col gap-4 p-2 sm:p-4 lg:gap-6 lg:p-6 bg-background print:bg-transparent print:p-0 print:gap-0">
              {children}
            </main>
          </div>
        </div>
      </AppProvider>
    </FirebaseClientProvider>
  );
}
