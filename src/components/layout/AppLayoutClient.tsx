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
import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ClientOnly } from "@/components/ClientOnly";

const NavLink = ({ href, icon, label, isCollapsed, onClick }: { href: string, icon: React.ReactNode, label: string, isCollapsed: boolean, onClick?: () => void }) => {
  const pathname = usePathname();
  let isActive = false;
  
  if (href === '/home') {
    isActive = pathname === href;
  } else if (href === '/matches') {
    isActive = (pathname === '/matches' || (pathname.startsWith('/matches/') && !pathname.startsWith('/matches/new')));
  } else {
    isActive = pathname.startsWith(href);
  }

  return (
    <TooltipProvider delayDuration={0}>
        <Tooltip>
            <TooltipTrigger asChild>
                 <Link
                    href={href}
                    onClick={onClick}
                    className={`flex items-center gap-3 rounded-lg py-2 transition-all duration-200 ${isCollapsed ? 'h-10 w-10 justify-center' : 'px-3'} ${isActive ? 'bg-primary/10 text-primary font-semibold shadow-sm' : 'text-muted-foreground hover:text-primary hover:bg-muted/50'}`}
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

  // Auto-collapse sidebar on smaller desktop screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && window.innerWidth >= 768) {
        setIsSidebarCollapsed(true);
      } else if (window.innerWidth >= 1024) {
        setIsSidebarCollapsed(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`flex min-h-screen w-full transition-all duration-300 ease-in-out`}>
      {/* Sidebar - Hidden on mobile */}
      <aside className={`hidden md:flex flex-col border-r bg-muted/30 print:hidden sticky top-0 h-screen transition-all duration-300 ${isSidebarCollapsed ? 'w-[72px]' : 'w-[240px] lg:w-[280px]'}`}>
        <div className="flex h-full flex-col">
          <div className={`flex h-14 items-center border-b lg:h-[60px] ${isSidebarCollapsed ? 'justify-center px-2' : 'px-6'}`}>
            <Link href="/" className="flex items-center gap-2 font-bold focus:outline-none transition-transform active:scale-95">
              <Image src="/logo.svg" alt="CricMates Logo" width={32} height={32} />
              {!isSidebarCollapsed && <span className="font-headline tracking-tight text-xl text-primary">CricMates</span>}
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto py-6 scrollbar-hide">
              <nav className={`grid items-start gap-1 ${isSidebarCollapsed ? 'px-3' : 'px-4'}`}>
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
          <div className="mt-auto border-t p-3">
              <Button variant="ghost" size="icon" className="w-full h-10 hover:bg-muted flex items-center justify-center transition-colors" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>
                  {isSidebarCollapsed ? <PanelRightOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                  <span className="sr-only">Toggle Sidebar</span>
              </Button>
          </div>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
          {/* Header */}
          <header className="flex h-14 items-center gap-4 border-b bg-background/80 px-4 lg:h-[60px] lg:px-6 print:hidden sticky top-0 z-30 backdrop-blur-md">
            <ClientOnly fallback={<Skeleton className="h-10 w-10 shrink-0 md:hidden" />}>
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0 md:hidden h-9 w-9">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle navigation menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex flex-col p-0 w-[280px]">
                  <div className="flex h-14 items-center border-b px-6">
                    <Link href="/" className="flex items-center gap-2 font-bold" onClick={() => setIsMobileMenuOpen(false)}>
                      <Image src="/logo.svg" alt="CricMates Logo" width={28} height={28} />
                      <span className="font-headline text-lg text-primary">CricMates</span>
                    </Link>
                  </div>
                  <nav className="grid gap-1 p-4 text-base font-medium">
                      <NavLink href="/home" icon={<Home className="h-5 w-5" />} label="Home" isCollapsed={false} onClick={() => setIsMobileMenuOpen(false)} />
                      <NavLink href="/teams" icon={<Users className="h-5 w-5" />} label="Teams" isCollapsed={false} onClick={() => setIsMobileMenuOpen(false)} />
                      <NavLink href="/matches/new" icon={<PlusCircle className="h-5 w-5" />} label="New Match" isCollapsed={false} onClick={() => setIsMobileMenuOpen(false)} />
                      <NavLink href="/matches" icon={<BarChart className="h-5 w-5" />} label="Match History" isCollapsed={false} onClick={() => setIsMobileMenuOpen(false)} />
                      <NavLink href="/points-table" icon={<Trophy className="h-5 w-5" />} label="Points Table" isCollapsed={false} onClick={() => setIsMobileMenuOpen(false)} />
                      <NavLink href="/player-stats" icon={<Medal className="h-5 w-5" />} label="Player Stats" isCollapsed={false} onClick={() => setIsMobileMenuOpen(false)} />
                      <NavLink href="/rankings" icon={<TrendingUp className="h-5 w-5" />} label="Rankings" isCollapsed={false} onClick={() => setIsMobileMenuOpen(false)} />
                      <NavLink href="/number-game" icon={<Sigma className="h-5 w-5" />} label="Number Game" isCollapsed={false} onClick={() => setIsMobileMenuOpen(false)} />
                  </nav>
                </SheetContent>
              </Sheet>
            </ClientOnly>
            {pathname !== '/home' && (
              <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-muted hidden sm:flex" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Button>
            )}
            <div className="flex-1 flex items-center">
                <span className="md:hidden font-headline font-bold text-primary text-lg truncate">
                    {pathname === '/home' ? 'Dashboard' : pathname.split('/').pop()?.replace(/-/g, ' ')}
                </span>
            </div>
            <ClientOnly fallback={<Skeleton className="h-8 w-8 rounded-full" />}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 bg-muted/50 hover:bg-muted">
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">User menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 mt-2">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuItem>Feedback</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive font-medium">
                    <LogOutIcon className="mr-2 h-4 w-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ClientOnly>
          </header>
        <main className="flex-1 overflow-x-hidden bg-background">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 md:space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}