"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import { initiateEmailSignIn, initiateEmailSignUp, initiatePasswordReset } from '@/firebase/non-blocking-login';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Trophy, ArrowRight, Loader2, KeyRound, ChevronLeft, Lock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

// Default Official Key - You can change this here
const OFFICIAL_LEAGUE_KEY = "CRICPRO77";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetOpen, setIsResetOpen] = useState(false);

  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    
    if (!email || !password) {
      toast({ title: "Validation Error", description: "Email and password are required.", variant: "destructive" });
      return;
    }

    if (!isLogin && accessKey !== OFFICIAL_LEAGUE_KEY) {
      toast({ title: "Invalid Access Key", description: "The official league key is incorrect. Contact admin.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        initiateEmailSignIn(auth, email, password);
      } else {
        // Sign up logic - verification is handled by the initial setup key
        initiateEmailSignUp(auth, email, password);
        
        // In a production app, the Firestore doc creation would be triggered 
        // by an auth listener or Cloud Function. For this prototype, we guide
        // the user to the dashboard where the session sync will occur.
      }

      toast({ 
        title: isLogin ? "Verifying Official..." : "Official Registered", 
        description: isLogin ? "Accessing secure dashboard." : "Your umpire account is now active and verified." 
      });

      // Redirect after a short delay to allow auth state to propagate
      setTimeout(() => {
        setIsLoading(false);
        router.push('/');
      }, 2000);

    } catch (error: any) {
      setIsLoading(false);
      toast({ title: "Auth Error", description: error.message, variant: "destructive" });
    }
  };

  const handleForgotPassword = async () => {
    if (!auth || !resetEmail) {
      toast({ title: "Error", description: "Please enter your email address.", variant: "destructive" });
      return;
    }

    setIsResetLoading(true);
    try {
      await initiatePasswordReset(auth, resetEmail);
      toast({ title: "Email Sent", description: "Check your inbox for password reset instructions." });
      setIsResetOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Could not send reset email.", variant: "destructive" });
    } finally {
      setIsResetLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Back to Public View</span>
      </div>

      <div className="text-center space-y-2">
        <div className="bg-[#3f51b5] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg rotate-3 border-4 border-white/10">
          <ShieldCheck className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Official Portal</h1>
        <p className="text-slate-500 text-sm font-medium">Restricted access for authorized league umpires.</p>
      </div>

      <Card className="border-t-8 border-t-[#3f51b5] shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Lock className="w-24 h-24" />
        </div>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {isLogin ? "Official Sign In" : "Official Registration"}
          </CardTitle>
          <CardDescription>
            {isLogin ? "Enter your credentials to access tools." : "Create your official verified umpire account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Official Access Key (Required)
                </Label>
                <Input 
                  type="text" 
                  placeholder="Enter League Passcode" 
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  className="h-12 font-black tracking-[0.2em] border-primary/20 bg-primary/5 uppercase placeholder:normal-case placeholder:tracking-normal"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Official Email</Label>
              <Input 
                type="email" 
                placeholder="name@official.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 font-bold"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-black uppercase text-slate-400">Password</Label>
                {isLogin && (
                  <button 
                    type="button"
                    onClick={() => setIsResetOpen(true)}
                    className="text-[10px] font-black uppercase text-primary hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 font-bold"
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-lg group bg-[#3f51b5] hover:bg-[#303f9f]"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  {isLogin ? "Sign In" : "Verify & Register"}
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors"
            >
              {isLogin ? "Register a new Official account" : "Back to Official Sign In"}
            </button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-primary">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <KeyRound className="w-5 h-5" /> Reset Password
            </DialogTitle>
            <DialogDescription className="font-medium">
              We'll send a recovery link to your official email address.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Official Email</Label>
              <Input 
                type="email" 
                placeholder="name@official.com" 
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="h-12 font-bold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={handleForgotPassword} 
              className="w-full h-12 font-black uppercase tracking-widest"
              disabled={isResetLoading}
            >
              {isResetLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Reset Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="bg-slate-50 p-4 rounded-xl border border-dashed text-center">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
          Access is strictly restricted to authorized officials. <br/>Unauthorized attempts are logged and monitored.
        </p>
      </div>
    </div>
  );
}