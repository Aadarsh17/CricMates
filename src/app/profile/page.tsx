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
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { 
  ShieldCheck, 
  User, 
  Camera, 
  Save, 
  ArrowLeft, 
  Loader2, 
  Sparkles, 
  Upload, 
  KeyRound, 
  Lock, 
  CheckCircle2, 
  Trophy, 
  Image as ImageIcon,
  Maximize,
  Move,
  RotateCcw,
  X,
  Eraser,
  ShieldAlert
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';

export default function UmpireProfilePage() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { isUmpire } = useApp();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const leagueLogoRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isBrandingSaving, setIsBrandingSaving] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    style: 'Elite Panel',
    imageUrl: '',
    isVerified: false
  });

  const [leagueBranding, setLeagueBranding] = useState({
    name: 'CricMates',
    logoUrl: ''
  });

  // Logo Calibration States
  const [rawLogo, setRawLogo] = useState<string | null>(null);
  const [logoScale, setLogoScale] = useState([1]); 
  const [logoOffset, setLogoOffset] = useState({ x: 0, y: 0 });
  const [shouldRemoveBg, setShouldRemoveBg] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isCalibrating, setIsCalibrating] = useState(false);

  const defaultAvatar = PlaceHolderImages.find(img => img.id === 'player-avatar')?.imageUrl || '';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const umpireRef = useMemoFirebase(() => 
    user?.uid ? doc(db, 'umpires', user.uid) : null, 
  [db, user?.uid]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(umpireRef);

  const leagueRef = useMemoFirebase(() => doc(db, 'settings', 'league'), [db]);
  const { data: leagueData } = useDoc(leagueRef);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        style: profile.style || 'Elite Panel',
        imageUrl: profile.imageUrl || '',
        isVerified: !!profile.isVerified
      });
    } else if (user && !isProfileLoading) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || `Umpire_${user.uid.substring(0, 4)}`
      }));
    }
  }, [profile, user, isProfileLoading]);

  useEffect(() => {
    if (leagueData) {
      setLeagueBranding({
        name: leagueData.name || 'CricMates',
        logoUrl: leagueData.logoUrl || ''
      });
    }
  }, [leagueData]);

  // High-Precision Canvas Drawing Logic with Advanced Background Removal
  const drawCanvas = () => {
    if (rawLogo && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.src = rawLogo;
      img.onload = () => {
        const size = 800; // Even higher res for crisp logos
        canvas.width = size;
        canvas.height = size;
        
        ctx.clearRect(0, 0, size, size);
        
        const scale = logoScale[0];
        const w = img.width;
        const h = img.height;
        
        // Base "Contain" multiplier with 15% safety margin
        const initialRatio = Math.min(size / w, size / h) * 0.85;
        const nw = w * initialRatio * scale;
        const nh = h * initialRatio * scale;
        
        // Center position + dynamic offsets
        const posX = (size - nw) / 2 + logoOffset.x;
        const posY = (size - nh) / 2 + logoOffset.y;
        
        ctx.drawImage(img, posX, posY, nw, nh);

        // ADVANCED COLOR-KEYING (Euclidean distance for better fringe removal)
        if (shouldRemoveBg) {
          const imageData = ctx.getImageData(0, 0, size, size);
          const data = imageData.data;
          const targetColor = { r: 255, g: 255, b: 255 }; // Target white/light-grey
          const tolerance = 45; // Wider tolerance to catch anti-aliased fringes

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Calculate distance from white
            const distance = Math.sqrt(
              Math.pow(r - targetColor.r, 2) +
              Math.pow(g - targetColor.g, 2) +
              Math.pow(b - targetColor.b, 2)
            );

            if (distance < tolerance) {
              data[i + 3] = 0; // Make fully transparent
            }
          }
          ctx.putImageData(imageData, 0, 0);
        }
      };
    }
  };

  useEffect(() => {
    drawCanvas();
  }, [rawLogo, logoScale, logoOffset, shouldRemoveBg]);

  const handleStartDrag = (e: any) => {
    setIsDragging(true);
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - logoOffset.x, y: clientY - logoOffset.y });
  };

  const handleDrag = (e: any) => {
    if (!isDragging || !containerRef.current) return;
    
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    
    const containerWidth = containerRef.current.offsetWidth;
    const sensitivity = 800 / containerWidth;

    setLogoOffset({
      x: (clientX - dragStart.x) * sensitivity,
      y: (clientY - dragStart.y) * sensitivity
    });
  };

  const handleEndDrag = () => {
    setIsDragging(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'profile' | 'league') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: "Image too large", description: "Max size is 2MB.", variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'profile') {
          setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
          toast({ title: "Profile photo ready" });
        } else {
          setRawLogo(reader.result as string);
          setIsCalibrating(true);
          setLogoScale([1]);
          setLogoOffset({ x: 0, y: 0 });
          toast({ title: "Calibration Mode", description: "Knock out background and align logo." });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyCalibration = () => {
    if (canvasRef.current) {
      const bakedDataUrl = canvasRef.current.toDataURL('image/png');
      setLeagueBranding(prev => ({ ...prev, logoUrl: bakedDataUrl }));
      setIsCalibrating(false);
      setRawLogo(null);
      toast({ title: "Calibration Applied", description: "Logo baked with transparency." });
    }
  };

  const handleSave = () => {
    if (!user?.uid) return;
    setIsSaving(true);
    setDocumentNonBlocking(doc(db, 'umpires', user.uid), {
      id: user.uid,
      ...formData,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    setTimeout(() => {
      setIsSaving(false);
      toast({ title: "Profile Updated" });
    }, 500);
  };

  const handleSaveBranding = () => {
    if (!isUmpire) return;
    setIsBrandingSaving(true);
    setDocumentNonBlocking(doc(db, 'settings', 'league'), {
      ...leagueBranding,
      updatedBy: user?.uid,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    setTimeout(() => {
      setIsBrandingSaving(false);
      toast({ title: "Branding Committed" });
    }, 500);
  };

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleChangePassword = async () => {
    if (!user) return;
    if (!newPassword || newPassword !== confirmPassword) {
      toast({ title: "Validation Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    setIsUpdatingPassword(true);
    try {
      await updatePassword(user, newPassword);
      toast({ title: "Password Updated" });
      setNewPassword(''); setConfirmPassword('');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!isMounted) return null;

  if (isUserLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
      <p className="font-black uppercase tracking-widest text-slate-400 text-xs">Syncing Identity...</p>
    </div>
  );

  if (!isUmpire) {
    return (
      <Card className="max-w-md mx-auto mt-12 border-t-8 border-t-primary shadow-2xl">
        <CardContent className="pt-8 text-center space-y-6">
          <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto"><ShieldCheck className="w-10 h-10 text-primary" /></div>
          <h2 className="text-2xl font-black uppercase">Access Restricted</h2>
          <Button onClick={() => router.push('/auth')} className="w-full font-black uppercase h-12">Umpire Login</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-24 space-y-8 px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ArrowLeft className="w-6 h-6" /></Button>
        <div>
          <h1 className="text-3xl font-black uppercase text-slate-900 leading-tight">Official Hub</h1>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Franchise & Profile Settings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="shadow-sm border-none bg-slate-50 overflow-hidden">
            <CardContent className="pt-8 flex flex-col items-center text-center space-y-4">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <Avatar className="w-28 h-28 border-4 border-white shadow-xl rounded-3xl overflow-hidden">
                  <AvatarImage src={formData.imageUrl || defaultAvatar} className="object-cover" />
                  <AvatarFallback className="bg-primary text-white text-4xl font-black">{formData.name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex flex-col items-center justify-center">
                  <Camera className="w-6 h-6 text-white mb-1" /><span className="text-[8px] text-white font-black uppercase">Change Photo</span>
                </div>
                <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, 'profile')} className="hidden" accept="image/*" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-lg truncate w-full">{formData.name || 'Official Umpire'}</h3>
                <div className="flex justify-center">
                  {formData.isVerified ? (
                    <Badge className="bg-emerald-500 text-white font-black text-[8px] uppercase flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Official Verified
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="font-black text-[8px] uppercase flex items-center gap-1">
                      <ShieldAlert className="w-2.5 h-2.5" /> Unverified
                    </Badge>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="bg-primary text-white font-black text-[9px] uppercase">{formData.style}</Badge>
            </CardContent>
          </Card>

          <Card className="shadow-2xl border-t-4 border-t-[#009688] overflow-hidden">
            <CardHeader className="bg-slate-50 py-3">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                <Trophy className="w-3.5 h-3.5 text-[#009688]" /> League Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {isCalibrating ? (
                <div className="space-y-6 animate-in fade-in zoom-in-95">
                  <div 
                    ref={containerRef}
                    className="aspect-square w-full bg-[#009688] rounded-[24px] overflow-hidden flex items-center justify-center border-4 border-white shadow-inner relative cursor-move touch-none"
                    onMouseDown={handleStartDrag}
                    onMouseMove={handleDrag}
                    onMouseUp={handleEndDrag}
                    onMouseLeave={handleEndDrag}
                    onTouchStart={handleStartDrag}
                    onTouchMove={handleDrag}
                    onTouchEnd={handleEndDrag}
                  >
                    {/* Checkerboard hint for transparency */}
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(45deg, #ffffff 25%, transparent 25%, transparent 75%, #ffffff 75%, #ffffff), linear-gradient(45deg, #ffffff 25%, transparent 25%, transparent 75%, #ffffff 75%, #ffffff)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px' }} />
                    <canvas ref={canvasRef} className="w-full h-full object-contain pointer-events-none z-10" />
                    {isDragging && (
                      <div className="absolute inset-0 bg-black/5 flex items-center justify-center pointer-events-none z-20">
                        <Move className="w-8 h-8 text-white/50 animate-pulse" />
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border">
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase">
                        <Eraser className="w-3.5 h-3.5 text-[#009688]" /> Kill White Background
                      </div>
                      <Switch checked={shouldRemoveBg} onCheckedChange={setShouldRemoveBg} />
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                      <span className="flex items-center gap-1"><Maximize className="w-3 h-3" /> Fine Zoom</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded font-mono">{logoScale[0].toFixed(2)}x</span>
                    </div>
                    <Slider 
                      value={logoScale} 
                      onValueChange={setLogoScale} 
                      min={0.5} 
                      max={2} 
                      step={0.01}
                      className="py-2"
                    />
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => { setLogoOffset({ x: 0, y: 0 }); setLogoScale([1]); }}
                        className="flex-1 text-[8px] font-black uppercase text-slate-400 h-8 border border-dashed"
                      >
                        <RotateCcw className="w-2.5 h-2.5 mr-1" /> Reset Alignment
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => setIsCalibrating(false)} variant="outline" size="sm" className="flex-1 font-black uppercase text-[10px] h-10">Cancel</Button>
                    <Button onClick={handleApplyCalibration} size="sm" className="flex-1 bg-primary font-black uppercase text-[10px] h-10 shadow-lg text-white">Apply Pro Decal</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group cursor-pointer" onClick={() => leagueLogoRef.current?.click()}>
                    <div className="w-24 h-24 bg-[#009688] rounded-[18px] flex items-center justify-center shadow-lg border-2 border-white/10 overflow-hidden relative">
                      {leagueBranding.logoUrl ? (
                        <img src={leagueBranding.logoUrl} className="w-full h-full object-contain" alt="Current Logo" />
                      ) : (
                        <Trophy className="w-8 h-8 text-white" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <input type="file" ref={leagueLogoRef} onChange={(e) => handleFileChange(e, 'league')} className="hidden" accept="image/*" />
                  </div>
                  <div className="w-full space-y-2">
                    <Label className="text-[8px] font-black uppercase text-slate-400">Official Brand Name</Label>
                    <Input value={leagueBranding.name} onChange={(e) => setLeagueBranding({...leagueBranding, name: e.target.value})} className="h-10 font-bold text-xs" />
                  </div>
                  <Button onClick={handleSaveBranding} disabled={isBrandingSaving} size="sm" className="w-full h-12 bg-[#009688] font-black uppercase text-[10px] shadow-lg text-white">
                    {isBrandingSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Commit Branding"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-xl border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Edit Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!formData.isVerified && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-3 mb-4 animate-pulse">
                  <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-rose-600">Access Restricted</p>
                    <p className="text-[11px] font-medium text-rose-500 leading-tight">You are currently unverified. You can view data, but editing matches or league settings is disabled. Contact admin to verify your official status.</p>
                  </div>
                </div>
              )}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Official Name</Label>
                  <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Full name" className="font-bold h-12 shadow-inner" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Officiating Style</Label>
                  <Select value={formData.style} onValueChange={v => setFormData({...formData, style: v})}>
                    <SelectTrigger className="font-bold h-12 shadow-inner"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[200]">
                      <SelectItem value="Elite Panel" className="font-bold">Elite Panel</SelectItem>
                      <SelectItem value="State Level" className="font-bold">State Level</SelectItem>
                      <SelectItem value="Club Official" className="font-bold">Club Official</SelectItem>
                      <SelectItem value="Gully Specialist" className="font-bold">Gully Specialist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSave} disabled={isSaving} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl text-white bg-primary">
                {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Save className="w-6 h-6 mr-2" /> Save Profile</>}
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-t-4 border-t-secondary">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Lock className="w-4 h-4 text-secondary" /> Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">New Password</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="font-bold h-12 shadow-inner" /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Confirm</Label><Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="font-bold h-12 shadow-inner" /></div>
              </div>
              <Button variant="secondary" onClick={handleChangePassword} disabled={isUpdatingPassword || !newPassword} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl text-white">
                {isUpdatingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
