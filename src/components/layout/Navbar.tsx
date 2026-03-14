
"use client"

import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { useUser, useAuth, useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { signOut } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { 
  Trophy, 
  Users, 
  LayoutDashboard, 
  ShieldCheck, 
  LogIn, 
  LogOut, 
  Menu, 
  X, 
  PlayCircle, 
  UserCircle, 
  History, 
  UserCog, 
  BarChart3, 
  LineChart 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useRouter, usePathname } from 'next/navigation';

export default function Navbar() {
  const { isUmpire } = useApp();
  const { user } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const leagueRef = useMemoFirebase(() => doc(db, 'settings', 'league'), [db]);
  const { data: leagueBranding } = useDoc(leagueRef);

  const navLinks = [
    { name: 'Home', href: '/', icon: LayoutDashboard },
    { name: 'Match History', href: '/matches', icon: History },
    { name: 'Teams', href: '/teams', icon: Users },
    { name: 'Players', href: '/players', icon: UserCircle },
    { name: 'Rankings', href: '/rankings', icon: Trophy },
    { name: 'Stats', href: '/stats', icon: BarChart3 },
    { name: 'Insights', href: '/insights', icon: LineChart },
    { name: 'Number Game', href: '/number-game', icon: PlayCircle },
  ];

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/');
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] bg-[#3f51b5] border-b border-white/10 shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center space-x-3 group shrink-0">
            <div className="p-1.5 bg-[#009688] rounded-xl shadow-md group-hover:scale-105 transition-transform overflow-hidden w-10 h-10 flex items-center justify-center">
              {leagueBranding?.logoUrl ? (
                <img src={leagueBranding.logoUrl} className="w-full h-full object-cover" alt="League Logo" />
              ) : (
                <Trophy className="w-6 h-6 text-white" />
              )}
            </div>
            <span className="font-headline font-black text-2xl tracking-tighter uppercase text-white">
              {leagueBranding?.name || 'CricMates'}
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden xl:flex items-center space-x-1 h-full">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link 
                  key={link.href} 
                  href={link.href} 
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-lg transition-all text-[11px] font-black uppercase tracking-tight h-10",
                    isActive 
                      ? "bg-white/20 text-white shadow-sm" 
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  )}
                >
                  <link.icon className="w-4 h-4" />
                  <span className="whitespace-nowrap">{link.name}</span>
                </Link>
              );
            })}
            
            <div className="w-px h-6 mx-2 bg-white/20" />
            
            {isUmpire ? (
              <div className="flex items-center gap-2">
                <Link href="/profile" className={cn(
                  "flex items-center space-x-2 px-3 py-2 rounded-lg transition-all text-[11px] font-black uppercase tracking-tight",
                  pathname === '/profile' ? "bg-white/20 text-white" : "text-white/80 hover:text-white"
                )}>
                  <UserCog className="w-4 h-4" />
                  <span>Profile</span>
                </Link>
                <Button 
                  variant="secondary"
                  size="sm"
                  onClick={handleSignOut}
                  className="rounded-lg font-black uppercase text-[10px] tracking-widest h-9 px-4 shadow-md"
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                asChild
                className="rounded-lg font-black uppercase text-[10px] tracking-widest h-9 px-4 bg-white/10 text-white border-white/20 hover:bg-white/20"
              >
                <Link href="/auth">
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  <span>Official</span>
                </Link>
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="xl:hidden flex items-center">
            <button 
              onClick={() => setIsOpen(!isOpen)} 
              className="p-2 rounded-xl text-white hover:bg-white/10 transition-colors"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="xl:hidden bg-white shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 overflow-y-auto max-h-[85vh] border-t">
          <div className="p-4 space-y-1">
            {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href} 
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center space-x-4 p-4 rounded-xl transition-all text-sm font-black uppercase tracking-widest",
                  pathname === link.href ? "bg-[#3f51b5] text-white shadow-lg" : "text-slate-600 hover:bg-slate-50"
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
                  "flex items-center space-x-4 p-4 rounded-xl transition-all text-sm font-black uppercase tracking-widest",
                  pathname === '/profile' ? "bg-[#009688] text-white shadow-lg" : "text-slate-600 hover:bg-slate-50"
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
                  className="w-full h-12 rounded-xl font-black uppercase tracking-widest shadow-md"
                  onClick={() => {
                    handleSignOut();
                    setIsOpen(false);
                  }}
                >
                  <LogOut className="w-5 h-5 mr-2" />
                  <span>Exit Session</span>
                </Button>
              ) : (
                <Button 
                  variant="default" 
                  className="w-full h-12 rounded-xl font-black uppercase tracking-widest shadow-lg bg-[#3f51b5]"
                  asChild
                  onClick={() => setIsOpen(false)}
                >
                  <Link href="/auth">
                    <LogIn className="w-5 h-5 mr-2" />
                    <span>Umpire Login</span>
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
