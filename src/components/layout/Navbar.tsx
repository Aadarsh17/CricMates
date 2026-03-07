"use client"

import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Trophy, Users, LayoutDashboard, ShieldCheck, LogIn, LogOut, Menu, X, Play, UserCircle, History, UserCog, BarChart3, LineChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useRouter, usePathname } from 'next/navigation';

export default function Navbar() {
  const { isUmpire } = useApp();
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '/', icon: LayoutDashboard },
    { name: 'Matches', href: '/matches', icon: History },
    { name: 'Teams', href: '/teams', icon: Users },
    { name: 'Insights', href: '/insights', icon: LineChart },
    { name: 'Street Pro', href: '/number-game', icon: Play },
  ];

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/');
    }
  };

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-[100] transition-all duration-300",
      scrolled ? "bg-white/80 backdrop-blur-xl border-b shadow-lg py-2" : "bg-primary py-4"
    )}>
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className={cn(
              "p-2 rounded-xl transition-all shadow-xl group-hover:scale-110",
              scrolled ? "bg-primary text-white" : "bg-secondary text-white"
            )}>
              <Trophy className="w-6 h-6" />
            </div>
            <span className={cn(
              "font-headline font-black text-2xl tracking-tighter uppercase transition-colors",
              scrolled ? "text-slate-900" : "text-white"
            )}>CricMates</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center space-x-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link 
                  key={link.href} 
                  href={link.href} 
                  className={cn(
                    "flex items-center space-x-2 px-4 py-2 rounded-xl transition-all text-xs font-black uppercase tracking-widest",
                    scrolled 
                      ? (isActive ? "bg-primary/10 text-primary" : "text-slate-500 hover:text-primary hover:bg-slate-100")
                      : (isActive ? "bg-white/20 text-white" : "text-white/70 hover:text-white hover:bg-white/10")
                  )}
                >
                  <link.icon className="w-4 h-4" />
                  <span>{link.name}</span>
                </Link>
              );
            })}
            
            <div className={cn("w-px h-6 mx-4", scrolled ? "bg-slate-200" : "bg-white/20")} />
            
            {isUmpire ? (
              <div className="flex items-center gap-2">
                <Link href="/profile" className={cn(
                  "flex items-center space-x-2 px-4 py-2 rounded-xl transition-all text-xs font-black uppercase tracking-widest",
                  scrolled 
                    ? (pathname === '/profile' ? "bg-secondary/10 text-secondary" : "text-slate-500 hover:text-secondary")
                    : (pathname === '/profile' ? "bg-white/20 text-white" : "text-white/70 hover:text-white")
                )}>
                  <UserCog className="w-4 h-4" />
                  <span>Profile</span>
                </Link>
                <Button 
                  variant={scrolled ? "destructive" : "secondary"}
                  size="sm"
                  onClick={handleSignOut}
                  className="rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-6 shadow-xl"
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                asChild
                className={cn(
                  "rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-6",
                  scrolled ? "border-primary text-primary hover:bg-primary hover:text-white" : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                )}
              >
                <Link href="/auth">
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  <span>Official Login</span>
                </Link>
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden flex items-center">
            <button 
              onClick={() => setIsOpen(!isOpen)} 
              className={cn("p-2 rounded-xl transition-colors", scrolled ? "text-slate-900 bg-slate-100" : "text-white bg-white/10")}
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="lg:hidden bg-white/95 backdrop-blur-2xl border-b shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-6 space-y-2">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href} 
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center space-x-4 p-4 rounded-2xl transition-all text-sm font-black uppercase tracking-widest",
                  pathname === link.href ? "bg-primary text-white shadow-xl shadow-primary/20" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <link.icon className="w-5 h-5" />
                <span>{link.name}</span>
              </Link>
            ))}
            
            {isUmpire && (
              <Link 
                href="/profile" 
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center space-x-4 p-4 rounded-2xl transition-all text-sm font-black uppercase tracking-widest",
                  pathname === '/profile' ? "bg-secondary text-white shadow-xl" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <UserCog className="w-5 h-5" />
                <span>Official Profile</span>
              </Link>
            )}

            <div className="pt-4 mt-4 border-t border-slate-100">
              {isUmpire ? (
                <Button 
                  variant="destructive" 
                  className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl"
                  onClick={() => {
                    handleSignOut();
                    setIsOpen(false);
                  }}
                >
                  <LogOut className="w-5 h-5 mr-2" />
                  <span>Terminate Session</span>
                </Button>
              ) : (
                <Button 
                  variant="default" 
                  className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                  asChild
                  onClick={() => setIsOpen(false)}
                >
                  <Link href="/auth">
                    <LogIn className="w-5 h-5 mr-2" />
                    <span>Official Authenticate</span>
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}