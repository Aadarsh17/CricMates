"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';
import { initiateEmailSignIn, initiateEmailSignUp, initiatePasswordReset } from '@/firebase/non-blocking-login';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Trophy, ArrowRight, Loader2, KeyRound, ChevronLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetOpen, setIsResetOpen] = useState(false);

  const auth = useAuth();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    if (!email || !password) {
      toast({ title: "Validation Error", description: "Email and password are required.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    if (isLogin) {
      initiateEmailSignIn(auth, email, password);
    } else {
      initiateEmailSignUp(auth, email, password);
    }

    // Rely on FirebaseProvider to detect auth state change
    setTimeout(() => {
      setIsLoading(false);
      // We don't force redirect here, the layout handles auth state
      toast({ title: isLogin ? "Welcome Back!" : "Account Created", description: "Verifying credentials..." });
    }, 1500);
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
        <div className="bg-primary w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg rotate-3">
          <Trophy className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Umpire Portal</h1>
        <p className="text-slate-500 text-sm font-medium">Access official scoring and match management tools.</p>
      </div>

      <Card className="border-t-8 border-t-primary shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            {isLogin ? "Official Sign In" : "Register Credentials"}
          </CardTitle>
          <CardDescription>
            {isLogin ? "Enter your official email and password." : "Create your official umpire account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-lg group"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  {isLogin ? "Sign In" : "Register"}
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
              {isLogin ? "Need an account? Register here" : "Already registered? Sign in here"}
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
          Access is restricted to authorized league officials. <br/>All actions are logged in the official match history.
        </p>
      </div>
    </div>
  );
}
