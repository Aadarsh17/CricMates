
'use client';

import { Button } from "@/components/ui/button";
import { MoveRight, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export default function WelcomePage() {
  const [isNavigating, setIsNavigating] = useState(false);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background dark:bg-muted/20 overflow-hidden">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background dark:bg-black bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(hsl(var(--muted))_1px,transparent_1px)] [background-size:16px_16px]"></div>
      
      <div className="container mx-auto px-4 animate-in fade-in zoom-in duration-700">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-block p-4 bg-primary/10 rounded-3xl shadow-sm mb-2">
            <Image
              src="/logo.svg"
              alt="CricMates Logo"
              width={56}
              height={56}
              className="drop-shadow-sm"
            />
          </div>
          
          <h1 className="text-4xl md:text-7xl font-headline font-extrabold text-foreground tracking-tight leading-[1.1]">
            Welcome, Mates <br/>
            to <span className="text-primary bg-clip-text">CricMates</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Your ultimate companion for every match. Effortless scoring, powerful stats, and team management.
          </p>
          
          <div className="flex justify-center pt-6">
            <Button
              asChild
              size="lg"
              onClick={() => setIsNavigating(true)}
              className="group h-14 px-10 text-lg rounded-full shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95 disabled:opacity-80"
            >
              <Link href="/home">
                {isNavigating ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <>
                    Get Started{" "}
                    <MoveRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
