"use client"

import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { Trophy, Users, LayoutDashboard, ShieldCheck, User, Menu, X, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function Navbar() {
  const { role, setRole, isUmpire } = useApp();
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: 'Home', href: '/', icon: LayoutDashboard },
    { name: 'Matches', href: '/matches', icon: Play },
    { name: 'Rankings', href: '/rankings', icon: Trophy },
    { name: 'Teams', href: '/teams', icon: Users },
    { name: 'Number Game', href: '/number-game', icon: Users },
  ];

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
              <Link key={link.href} href={link.href} className="flex items-center space-x-1 hover:text-secondary transition-colors">
                <link.icon className="w-4 h-4" />
                <span>{link.name}</span>
              </Link>
            ))}
            <div className="border-l border-primary-foreground/20 h-6 mx-2" />
            <Button 
              variant={isUmpire ? "secondary" : "outline"} 
              size="sm"
              onClick={() => setRole(isUmpire ? 'guest' : 'umpire')}
              className={cn("flex items-center space-x-2", !isUmpire && "bg-transparent text-white border-white hover:bg-white/10")}
            >
              {isUmpire ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
              <span>{isUmpire ? "Umpire Mode" : "Guest Mode"}</span>
            </Button>
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
          <div className="pt-2 border-t border-white/20">
            <Button 
              variant={isUmpire ? "secondary" : "outline"} 
              className="w-full justify-start mt-2"
              onClick={() => {
                setRole(isUmpire ? 'guest' : 'umpire');
                setIsOpen(false);
              }}
            >
              {isUmpire ? <ShieldCheck className="w-4 h-4 mr-2" /> : <User className="w-4 h-4 mr-2" />}
              <span>{isUmpire ? "Switch to Guest" : "Switch to Umpire"}</span>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}