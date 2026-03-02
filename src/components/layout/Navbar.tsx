
"use client"

import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Trophy, Users, LayoutDashboard, ShieldCheck, LogIn, LogOut, Menu, X, Play, UserCircle, History, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const { isUmpire } = useApp();
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: 'Home', href: '/', icon: LayoutDashboard },
    { name: 'Match History', href: '/matches', icon: History },
    { name: 'Teams', href: '/teams', icon: Users },
    { name: 'Players', href: '/players', icon: UserCircle },
    { name: 'Rankings', href: '/rankings', icon: Trophy },
    { name: 'Number Game', href: '/number-game', icon: Play },
  ];

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/');
    }
  };

  return (
    <nav className="bg-primary text-primary-foreground sticky top-0 z-50 shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-2">
            <div className="bg-secondary p-1.5 rounded-lg">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <span className="font-headline font-bold text-xl tracking-tight">CricMates</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="flex items-center space-x-1 hover:text-secondary transition-colors text-sm font-medium">
                <link.icon className="w-4 h-4" />
                <span>{link.name}</span>
              </Link>
            ))}
            
            <div className="border-l border-primary-foreground/20 h-6 mx-2" />
            
            {isUmpire ? (
              <>
                <Link href="/profile" className="flex items-center space-x-1 hover:text-secondary transition-colors text-sm font-medium">
                  <UserCog className="w-4 h-4" />
                  <span className="hidden lg:inline">Profile</span>
                </Link>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={handleSignOut}
                  className="flex items-center space-x-2 ml-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </Button>
              </>
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                asChild
                className="bg-transparent text-white border-white hover:bg-white/10"
              >
                <Link href="/auth">
                  <LogIn className="w-4 h-4 mr-2" />
                  <span>Umpire Login</span>
                </Link>
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsOpen(!isOpen)} className="p-2">
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden bg-primary pb-4 px-4 space-y-2">
          {navLinks.map((link) => (
            <Link 
              key={link.href} 
              href={link.href} 
              onClick={() => setIsOpen(false)}
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-white/10 transition-colors"
            >
              <link.icon className="w-5 h-5" />
              <span>{link.name}</span>
            </Link>
          ))}
          
          {isUmpire && (
            <Link 
              href="/profile" 
              onClick={() => setIsOpen(false)}
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-white/10 transition-colors"
            >
              <UserCog className="w-5 h-5" />
              <span>Official Profile</span>
            </Link>
          )}

          <div className="pt-2 border-t border-white/20">
            {isUmpire ? (
              <Button 
                variant="secondary" 
                className="w-full justify-start mt-2"
                onClick={() => {
                  handleSignOut();
                  setIsOpen(false);
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span>Sign Out</span>
              </Button>
            ) : (
              <Button 
                variant="outline" 
                className="w-full justify-start mt-2 bg-transparent text-white border-white hover:bg-white/10"
                asChild
                onClick={() => setIsOpen(false)}
              >
                <Link href="/auth">
                  <LogIn className="w-4 h-4 mr-2" />
                  <span>Umpire Login</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
