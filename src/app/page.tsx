import { Button } from "@/components/ui/button";
import { Shield, MoveRight } from "lucide-react";
import Link from "next/link";

export default function WelcomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background dark:bg-muted/20">
      <div className="absolute inset-0 -z-10 h-full w-full bg-background dark:bg-black bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(hsl(var(--muted))_1px,transparent_1px)] [background-size:16px_16px]"></div>
      <div className="container mx-auto px-4">
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-block p-4 bg-primary/10 rounded-2xl shadow-sm">
            <Shield className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-4xl md:text-6xl font-headline font-bold text-foreground tracking-tighter">
            Welcome to <span className="text-primary">CricMates</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Your all-in-one solution for tracking local cricket match scores,
            managing teams, and analyzing player performance. Get ready to
            elevate your game!
          </p>
          <div className="flex justify-center pt-4">
            <Button
              asChild
              size="lg"
              className="group shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow"
            >
              <Link href="/teams">
                Get Started{" "}
                <MoveRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
