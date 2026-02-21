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
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ClientOnly } from "@/components/ClientOnly";

const NavLink = ({ href, icon, label, isCollapsed }: { href: string, icon: React.ReactNode, label: string, isCollapsed: boolean }) => {
  const pathname = usePathname();
  let isActive = false;
  if (href === '/home') {
    isActive = pathname === href;
  } else if (href === '/matches') {
    isActive = pathname.startsWith('/matches') && !pathname.startsWith('/matches/new');
  } else {
    isActive = pathname.startsWith(href);
  }

  return (
    <TooltipProvider delayDuration={0}>
        <Tooltip>
            <TooltipTrigger asChild>
                 <Link
                    href={href}
                    className={`flex items-center gap-3 rounded-lg py-2 transition-all ${isCollapsed ? 'h-10 w-10 justify-center' : 'px-3'} ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:text-primary hover:bg-muted/50'}`}
                  >
                    {icon}
                    {!isCollapsed && <span className="truncate">{label}</span>}
                  </Link>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right"><p>{label}</p></TooltipContent>}
        </Tooltip>
    </TooltipProvider>
  )
}

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className={`grid min-h-screen w-full transition-[grid-template-columns] duration-300 ease-in-out ${isSidebarCollapsed ? 'md:grid-cols-[72px_1fr]' : 'md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr]'}`}>
      <aside className="hidden border-r bg-muted/40 md:flex md:flex-col print:hidden sticky top-0 h-screen">
        <div className="flex h-full flex-col">
          <div className={`flex h-14 items-center border-b lg:h-[60px] ${isSidebarCollapsed ? 'justify-center px-2' : 'px-4 lg:px-6'}`}>
            <Link href="/" className="flex items-center gap-2 font-bold focus:outline-none">
              <Image src="/logo.svg" alt="CricMates Logo" width={28} height={28} />
              {!isSidebarCollapsed && <span className="font-headline tracking-tight text-xl">CricMates</span>}
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
              <nav className={`grid items-start gap-1 ${isSidebarCollapsed ? 'px-2' : 'px-4'}`}>
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
              <Button variant="ghost" size="icon" className="w-full hover:bg-muted" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                  {isSidebarCollapsed ? <PanelRightOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                  <span className="sr-only">Toggle Sidebar</span>
              </Button>
          </div>
        </div>
      </aside>
      <div className="flex flex-col flex-1 min-w-0">
          <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 print:hidden sticky top-0 z-30 backdrop-blur-md">
            <ClientOnly fallback={<Skeleton className="h-10 w-10 shrink-0 md:hidden" />}>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle navigation menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex flex-col p-0">
                  <div className="flex h-14 items-center border-b px-6">
                    <Link href="/" className="flex items-center gap-2 font-bold">
                      <Image src="/logo.svg" alt="CricMates Logo" width={24} height={24} />
                      <span className="font-headline text-lg">CricMates</span>
                    </Link>
                  </div>
                  <nav className="grid gap-1 p-4 text-base font-medium">
                      <Link href="/home" className={`flex items-center gap-4 rounded-lg px-3 py-2 ${pathname === '/home' ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground hover:bg-muted'}`}>
                          <Home className="h-5 w-5" /> Home
                      </Link>
                      <Link href="/teams" className={`flex items-center gap-4 rounded-lg px-3 py-2 ${pathname.startsWith('/teams') ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground hover:bg-muted'}`}>
                          <Users className="h-5 w-5" /> Teams
                      </Link>
                      <Link href="/matches/new" className={`flex items-center gap-4 rounded-lg px-3 py-2 ${pathname === '/matches/new' ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground hover:bg-muted'}`}>
                          <PlusCircle className="h-5 w-5" /> New Match
                      </Link>
                      <Link href="/matches" className={`flex items-center gap-4 rounded-lg px-3 py-2 ${pathname.startsWith('/matches') && !pathname.startsWith('/matches/new') ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground hover:bg-muted'}`}>
                          <BarChart className="h-5 w-5" /> Match History
                      </Link>
                      <Link href="/points-table" className={`flex items-center gap-4 rounded-lg px-3 py-2 ${pathname.startsWith('/points-table') ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground hover:bg-muted'}`}>
                          <Trophy className="h-5 w-5" /> Points Table
                      </Link>
                      <Link href="/player-stats" className={`flex items-center gap-4 rounded-lg px-3 py-2 ${pathname.startsWith('/player-stats') ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground hover:bg-muted'}`}>
                          <Medal className="h-5 w-5" /> Player Stats
                      </Link>
                      <Link href="/rankings" className={`flex items-center gap-4 rounded-lg px-3 py-2 ${pathname.startsWith('/rankings') ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground hover:bg-muted'}`}>
                          <TrendingUp className="h-5 w-5" /> Rankings
                      </Link>
                      <Link href="/number-game" className={`flex items-center gap-4 rounded-lg px-3 py-2 ${pathname.startsWith('/number-game') ? 'bg-primary/10 text-primary font-bold' : 'text-muted-foreground hover:bg-muted'}`}>
                          <Sigma className="h-5 w-5" /> Number Game
                      </Link>
                  </nav>
                </SheetContent>
              </Sheet>
            </ClientOnly>
            {pathname !== '/home' && (
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Button>
            )}
            <div className="flex-1" />
            <ClientOnly fallback={<Skeleton className="h-8 w-8 rounded-full" />}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">User menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuItem>Feedback</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive">
                    <LogOutIcon className="mr-2 h-4 w-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ClientOnly>
          </header>
        <main className="flex-1 overflow-x-hidden bg-background p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
