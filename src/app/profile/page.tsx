
"use client"

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useUser, setDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, User, Camera, Save, ArrowLeft, Loader2, Sparkles, Upload, KeyRound, Lock, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function UmpireProfilePage() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { isUmpire, setRole } = useApp();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    style: 'Elite Panel',
    imageUrl: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const defaultAvatar = PlaceHolderImages.find(img => img.id === 'player-avatar')?.imageUrl || '';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const umpireRef = useMemoFirebase(() => 
    user?.uid ? doc(db, 'umpires', user.uid) : null, 
  [db, user?.uid]);
  
  const { data: profile, isLoading: isProfileLoading } = useDoc(umpireRef);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        style: profile.style || 'Elite Panel',
        imageUrl: profile.imageUrl || ''
      });
    } else if (user && !isProfileLoading) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || `Umpire_${user.uid.substring(0, 4)}`
      }));
    }
  }, [profile, user, isProfileLoading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit for base64 storage
        toast({ title: "Image too large", description: "Please select an image smaller than 1MB.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
        toast({ title: "Photo selected", description: "Click 'Commit Profile' to save your new photo." });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!user?.uid) return;
    if (!formData.name.trim()) {
      toast({ title: "Name Required", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    const updatedData = {
      id: user.uid,
      ...formData,
      updatedAt: new Date().toISOString()
    };

    setDocumentNonBlocking(doc(db, 'umpires', user.uid), updatedData, { merge: true });
    
    setTimeout(() => {
      setIsSaving(false);
      toast({ title: "Profile Updated", description: "Your official umpire credentials and photo have been saved." });
    }, 500);
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (!newPassword || newPassword !== confirmPassword) {
      toast({ title: "Validation Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Too Short", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updatePassword(user, newPassword);
      toast({ title: "Password Updated", description: "Your login credentials have been changed successfully." });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        toast({ title: "Session Expired", description: "For security, please sign out and sign back in to change your password.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message || "Could not update password.", variant: "destructive" });
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!isMounted) return null;

  if (isUserLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
      <p className="font-black uppercase tracking-widest text-slate-400 text-xs">Syncing Official Identity...</p>
    </div>
  );

  if (!isUmpire) {
    return (
      <Card className="max-w-md mx-auto mt-12 border-t-8 border-t-primary shadow-2xl">
        <CardContent className="pt-8 text-center space-y-6">
          <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black uppercase tracking-tight">Access Restricted</h2>
            <p className="text-slate-500 text-sm font-medium">You must be in Umpire Mode to manage an official profile.</p>
          </div>
          <Button onClick={() => router.push('/auth')} className="w-full font-black uppercase tracking-widest h-12">
            Umpire Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-24 space-y-8 px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-3xl font-black font-headline tracking-tighter uppercase text-slate-900">Official Profile</h1>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Officiating Credentials</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 shadow-sm border-none bg-slate-50 overflow-hidden h-fit">
          <CardContent className="pt-8 flex flex-col items-center text-center space-y-4">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Avatar className="w-32 h-32 border-4 border-white shadow-xl rounded-3xl overflow-hidden">
                <AvatarImage src={formData.imageUrl || defaultAvatar} className="object-cover" />
                <AvatarFallback className="bg-primary text-white text-4xl font-black">{formData.name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex flex-col items-center justify-center">
                <Camera className="w-8 h-8 text-white mb-1" />
                <span className="text-[8px] text-white font-black uppercase">Change Photo</span>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*"
              />
            </div>
            <div>
              <h3 className="font-black text-lg truncate w-full">{formData.name || 'Official Umpire'}</h3>
              <Badge variant="secondary" className="bg-primary text-white font-black text-[9px] uppercase mt-1">
                {formData.style}
              </Badge>
            </div>
            <div className="pt-4 w-full border-t space-y-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Digital Identity</p>
              <code className="text-[8px] block bg-white p-2 rounded border border-slate-200 truncate">
                ID: {user?.uid}
              </code>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-xl border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Edit Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Official Name</Label>
                  <Input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter your full name"
                    className="font-bold h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Officiating Style</Label>
                  <Select value={formData.style} onValueChange={v => setFormData({...formData, style: v})}>
                    <SelectTrigger className="font-bold h-12">
                      <SelectValue placeholder="Select Style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Elite Panel" className="font-bold">Elite Panel</SelectItem>
                      <SelectItem value="State Level" className="font-bold">State Level</SelectItem>
                      <SelectItem value="Club Official" className="font-bold">Club Official</SelectItem>
                      <SelectItem value="Gully Specialist" className="font-bold">Gully Specialist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={handleSave} 
                disabled={isSaving}
                className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-lg"
              >
                {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Save className="w-6 h-6 mr-2" /> Commit Changes</>}
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-t-4 border-t-secondary">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Lock className="w-4 h-4 text-secondary" /> Security & Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">New Password</Label>
                  <Input 
                    type="password"
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="font-bold h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Confirm Password</Label>
                  <Input 
                    type="password"
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="font-bold h-12"
                  />
                </div>
              </div>

              <Button 
                variant="secondary"
                onClick={handleChangePassword} 
                disabled={isUpdatingPassword || !newPassword}
                className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-lg"
              >
                {isUpdatingPassword ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CheckCircle2 className="w-6 h-6 mr-2" /> Update Password</>}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
