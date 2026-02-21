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
import { useState, useEffect, useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ClientOnly } from "@/components/ClientOnly";

const NavLink = ({ href, icon, label, isCollapsed, onClick }: { href: string, icon: React.ReactNode, label: string, isCollapsed: boolean, onClick?: () => void }) => {
  const pathname = usePathname();
  
  const isActive = useMemo(() => {
    if (href === '/home') return pathname === href;
    if (href === '/matches') return (pathname === '/matches' || (pathname.startsWith('/matches/') && !pathname.startsWith('/matches/new')));
    return pathname.startsWith(href);
  }, [pathname, href]);

  return (
    <TooltipProvider delayDuration={0}>
        <Tooltip>
            <TooltipTrigger asChild>
                 <Link
                    href={href}
                    onClick={onClick}
                    className={`flex items-center gap-3 rounded-xl py-2.5 transition-all duration-200 active:scale-[0.98] ${isCollapsed ? 'h-11 w-11 justify-center' : 'px-4'} ${isActive ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20' : 'text-muted-foreground hover:text-primary hover:bg-primary/5'}`}
                  >
                    {icon}
                    {!isCollapsed && <span className="truncate text-sm">{label}</span>}
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Simplified screen size handling
  useEffect(() => {
    const checkSize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1280) {
        setIsSidebarCollapsed(true);
      } else if (window.innerWidth >= 1280) {
        setIsSidebarCollapsed(false);
      }
    };
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const navItems = [
    { href: "/home", icon: <Home className="h-5 w-5" />, label: "Home" },
    { href: "/teams", icon: <Users className="h-5 w-5" />, label: "Teams" },
    { href: "/matches/new", icon: <PlusCircle className="h-5 w-5" />, label: "New Match" },
    { href: "/matches", icon: <BarChart className="h-5 w-5" />, label: "Match History" },
    { href: "/points-table", icon: <Trophy className="h-5 w-5" />, label: "Points Table" },
    { href: "/player-stats", icon: <Medal className="h-5 w-5" />, label: "Player Stats" },
    { href: "/rankings", icon: <TrendingUp className="h-5 w-5" />, label: "Rankings" },
    { href: "/number-game", icon: <Sigma className="h-5 w-5" />, label: "Number Game" },
  ];

  return (
    <div className="flex min-h-screen w-full bg-background selection:bg-primary/10">
      {/* Sidebar - Optimized Desktop */}
      <aside className={`hidden md:flex flex-col border-r bg-muted/10 print:hidden sticky top-0 h-screen transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-[76px]' : 'w-[260px] lg:w-[280px]'}`}>
        <div className="flex h-full flex-col">
          <div className={`flex h-16 items-center border-b px-6 ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}>
            <Link href="/home" className="flex items-center gap-3 font-bold transition-transform active:scale-95">
              <Image src="/logo.svg" alt="CricMates Logo" width={32} height={32} />
              {!isSidebarCollapsed && <span className="font-headline tracking-tighter text-2xl text-primary font-black">CricMates</span>}
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto py-6 scrollbar-hide">
              <nav className={`grid gap-1.5 ${isSidebarCollapsed ? 'px-3' : 'px-4'}`}>
                  {navItems.map((item) => (
                    <NavLink key={item.href} {...item} isCollapsed={isSidebarCollapsed} />
                  ))}
              </nav>
          </div>
          <div className="mt-auto border-t p-4">
              <Button variant="ghost" size="icon" className="w-full h-10 hover:bg-primary/5 text-muted-foreground flex items-center justify-center transition-colors" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                  {isSidebarCollapsed ? <PanelRightOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                  <span className="sr-only">Toggle Sidebar</span>
              </Button>
          </div>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
          {/* Optimized Header */}
          <header className="flex h-16 items-center gap-4 border-b bg-background/80 px-4 lg:px-8 print:hidden sticky top-0 z-30 backdrop-blur-xl">
            <ClientOnly fallback={<Skeleton className="h-10 w-10 shrink-0 md:hidden rounded-lg" />}>
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0 md:hidden h-10 w-10 rounded-xl bg-muted/20 border-none shadow-none">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex flex-col p-0 w-[280px] border-r-none">
                  <div className="flex h-16 items-center border-b px-6">
                    <Link href="/home" className="flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
                      <Image src="/logo.svg" alt="CricMates Logo" width={32} height={32} />
                      <span className="font-headline text-xl text-primary font-black">CricMates</span>
                    </Link>
                  </div>
                  <nav className="grid gap-1.5 p-4">
                      {navItems.map((item) => (
                        <NavLink key={item.href} {...item} isCollapsed={false} onClick={() => setIsMobileMenuOpen(false)} />
                      ))}
                  </nav>
                </SheetContent>
              </Sheet>
            </ClientOnly>

            {pathname !== '/home' && (
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-muted hidden sm:flex rounded-full" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}

            <div className="flex-1 flex items-center">
                <span className="md:hidden font-headline font-black text-primary text-xl tracking-tight truncate">
                    {pathname === '/home' ? 'Dashboard' : pathname.split('/').pop()?.replace(/-/g, ' ')}
                </span>
            </div>

            <ClientOnly fallback={<Skeleton className="h-10 w-10 rounded-full" />}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 bg-muted/30 hover:bg-muted transition-all active:scale-95 overflow-hidden">
                    <div className="h-full w-full bg-primary/10 flex items-center justify-center">
                        <MoreVertical className="h-5 w-5 text-primary" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 mt-2 rounded-2xl shadow-2xl border-muted/50 p-2">
                  <DropdownMenuLabel className="px-3">My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="rounded-xl px-3 py-2 cursor-pointer">Settings</DropdownMenuItem>
                  <DropdownMenuItem className="rounded-xl px-3 py-2 cursor-pointer">Feedback</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive font-bold rounded-xl px-3 py-2 cursor-pointer">
                    <LogOutIcon className="mr-2 h-4 w-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ClientOnly>
          </header>

        <main className="flex-1 overflow-x-hidden bg-background/50">
          <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-10 space-y-8 page-transition">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}