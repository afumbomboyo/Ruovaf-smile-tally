
"use client"

import React, { useState, useEffect } from 'react';
import { generateLovingPrompt } from '@/ai/flows/ai-generated-smile-prompt';
import { 
  Heart, 
  Smile, 
  Users, 
  Settings, 
  History, 
  EyeOff, 
  ArrowLeft,
  Sparkles,
  ChevronRight,
  Lock,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  useFirestore, 
  useDoc, 
  useCollection,
  useMemoFirebase,
  setDocumentNonBlocking,
  updateDocumentNonBlocking,
  initiateAnonymousSignIn,
  useUser,
  useAuth
} from '@/firebase';
import { doc, collection, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';

type PartnerRole = 'afu' | 'ruovaf';

export default function RuovafApp() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [activeRole, setActiveRole] = useState<PartnerRole | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);

  const [coupleName, setCoupleName] = useState('');
  const [isCoupleSet, setIsCoupleSet] = useState(false);

  const [tempRole, setTempRole] = useState<PartnerRole | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

  // Load persistence on mount
  useEffect(() => {
    const storedCouple = localStorage.getItem('ruovaf_couple');
    const storedRole = localStorage.getItem('ruovaf_role') as PartnerRole;
    const storedAuth = localStorage.getItem('ruovaf_auth') === 'true';

    if (storedCouple) {
      setCoupleName(storedCouple);
      setIsCoupleSet(true);
    }
    if (storedRole && storedAuth) {
      setActiveRole(storedRole);
      setIsAuthenticated(true);
    }
  }, []);

  // Firebase Auth - Trigger anonymous sign-in
  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // Firestore Data References
  const afuRef = useMemoFirebase(() => {
    if (!coupleName || !user) return null;
    return doc(db, 'partners', `${coupleName}_afu`);
  }, [db, coupleName, user]);
  const { data: afuData, isLoading: isAfuLoading } = useDoc(afuRef);

  const ruovafRef = useMemoFirebase(() => {
    if (!coupleName || !user) return null;
    return doc(db, 'partners', `${coupleName}_ruovaf`);
  }, [db, coupleName, user]);
  const { data: ruovafData, isLoading: isRuovafLoading } = useDoc(ruovafRef);

  // History for active user
  const historyQuery = useMemoFirebase(() => {
    if (!activeRole || !coupleName || !user) return null;
    return query(
      collection(db, 'partners', `${coupleName}_${activeRole}`, 'dailySmileRecords'),
      orderBy('recordDate', 'desc'),
      limit(30)
    );
  }, [db, activeRole, coupleName, user]);
  const { data: smileHistory } = useCollection(historyQuery);

  // Cameroon Timezone Reset Logic (WAT, UTC+1)
  const getTodayStr = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Douala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  };

  const handleIncrement = async () => {
    if (!activeRole || !isAuthenticated || !coupleName || !user) return;

    const today = getTodayStr();
    const currentRef = activeRole === 'afu' ? afuRef : ruovafRef;
    const currentData = activeRole === 'afu' ? afuData : ruovafData;

    if (!currentRef) return;

    // Check if the date has changed since the last update
    const lastDate = currentData?.lastUpdateDate;
    let newCount = 1;
    
    if (lastDate === today) {
      newCount = (currentData?.currentSmileCount || 0) + 1;
    }
    
    updateDocumentNonBlocking(currentRef, {
      currentSmileCount: newCount,
      lastUpdateDate: today,
      lastLoginAt: serverTimestamp()
    });

    // Also update history record for the day
    const historyRef = doc(db, 'partners', `${coupleName}_${activeRole}`, 'dailySmileRecords', today);
    setDocumentNonBlocking(historyRef, {
      recordDate: today,
      partnerId: activeRole,
      smileCount: newCount,
    }, { merge: true });

    // AI Loving Thought Generation
    setIsLoadingPrompt(true);
    setAiPrompt(null); // Clear previous to show loading state
    try {
      const result = await generateLovingPrompt({});
      if (result && result.prompt) {
        setAiPrompt(result.prompt);
      }
    } catch (error) {
      console.error("AI Generation failed:", error);
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  const toggleVisibility = () => {
    if (!activeRole) return;
    const currentRef = activeRole === 'afu' ? afuRef : ruovafRef;
    const currentData = activeRole === 'afu' ? afuData : ruovafData;
    
    if (currentRef) {
      updateDocumentNonBlocking(currentRef, {
        visibilityEnabled: !currentData?.visibilityEnabled
      });
    }
  };

  const handlePartnerSelect = (role: PartnerRole) => {
    setTempRole(role);
    setPasswordInput('');
    setConfirmPasswordInput('');
  };

  const handleAuth = () => {
    if (!tempRole || !user) {
      toast({ variant: "destructive", title: "Wait", description: "Connecting to heart... please try again in a moment." });
      return;
    }
    
    const roleData = tempRole === 'afu' ? afuData : ruovafData;
    const roleRef = tempRole === 'afu' ? afuRef : ruovafRef;

    if (!roleRef) return;

    // First time setup
    if (!roleData || !roleData.password) {
      if (passwordInput.length < 4) {
        toast({ variant: "destructive", title: "Weak Password", description: "Please use at least 4 characters." });
        return;
      }
      if (passwordInput !== confirmPasswordInput) {
        toast({ variant: "destructive", title: "Mismatch", description: "Passwords do not match." });
        return;
      }

      setDocumentNonBlocking(roleRef, {
        id: tempRole,
        displayName: tempRole === 'afu' ? 'Afu' : 'Ruovaf',
        password: passwordInput,
        currentSmileCount: 0,
        lastUpdateDate: getTodayStr(),
        visibilityEnabled: true,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        partneredWithId: tempRole === 'afu' ? 'ruovaf' : 'afu'
      }, { merge: true });

      setActiveRole(tempRole);
      setIsAuthenticated(true);
      setTempRole(null);
      
      // Persistence
      localStorage.setItem('ruovaf_couple', coupleName);
      localStorage.setItem('ruovaf_role', tempRole);
      localStorage.setItem('ruovaf_auth', 'true');

      toast({ title: "Heart Connected", description: `Welcome, ${tempRole === 'afu' ? 'Afu' : 'Ruovaf'}!` });
    } else {
      // Existing user login
      if (passwordInput === roleData.password) {
        setActiveRole(tempRole);
        setIsAuthenticated(true);
        setTempRole(null);
        
        // Persistence
        localStorage.setItem('ruovaf_couple', coupleName);
        localStorage.setItem('ruovaf_role', tempRole);
        localStorage.setItem('ruovaf_auth', 'true');

        updateDocumentNonBlocking(roleRef, { lastLoginAt: serverTimestamp() });
      } else {
        toast({ variant: "destructive", title: "Access Denied", description: "Incorrect password." });
      }
    }
  };

  const handlePasswordChange = () => {
    if (!activeRole) return;
    const roleRef = activeRole === 'afu' ? afuRef : ruovafRef;

    if (!roleRef) return;

    if (passwordInput.length < 4) {
      toast({ variant: "destructive", title: "Weak Password", description: "Please use at least 4 characters." });
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      toast({ variant: "destructive", title: "Mismatch", description: "Passwords do not match." });
      return;
    }

    updateDocumentNonBlocking(roleRef, { password: passwordInput });
    toast({ title: "Updated", description: "Your password has been changed." });
    setPasswordInput('');
    setConfirmPasswordInput('');
  };

  const handleLogout = () => {
    localStorage.removeItem('ruovaf_couple');
    localStorage.removeItem('ruovaf_role');
    localStorage.removeItem('ruovaf_auth');
    setActiveRole(null);
    setIsAuthenticated(false);
    setAiPrompt(null);
    setTempRole(null);
    setIsCoupleSet(false);
  };

  if (isUserLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse font-medium">Connecting to heart...</p>
      </div>
    </div>
  );

  if (!isCoupleSet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full space-y-10 fade-in text-center">
          <div className="mx-auto bg-primary/5 w-40 h-40 rounded-full flex items-center justify-center shadow-inner">
            <Heart className="w-20 h-20 text-primary animate-pulse fill-primary/10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-primary">Afu & Ruovaf</h1>
            <p className="text-muted-foreground">Enter your shared Couple Name to enter your journey.</p>
          </div>
          <div className="space-y-4">
            <Input 
              placeholder="e.g. OurSweetHome" 
              value={coupleName}
              onChange={(e) => setCoupleName(e.target.value.toLowerCase().trim().replace(/\s+/g, ''))}
              className="text-center h-14 text-xl rounded-2xl border-primary/20 focus-visible:ring-primary shadow-sm"
              onKeyDown={(e) => e.key === 'Enter' && coupleName && setIsCoupleSet(true)}
            />
            <Button 
              className="w-full h-14 text-xl rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all" 
              disabled={!coupleName}
              onClick={() => {
                localStorage.setItem('ruovaf_couple', coupleName);
                setIsCoupleSet(true);
              }}
            >
              Enter Shared Journey
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const roleLoading = tempRole === 'afu' ? isAfuLoading : isRuovafLoading;
    const targetData = tempRole === 'afu' ? afuData : ruovafData;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full space-y-8 fade-in">
          <header className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="icon" onClick={() => setIsCoupleSet(false)} className="rounded-full">
               <ArrowLeft className="w-5 h-5" />
            </Button>
            <Badge variant="secondary" className="px-3 py-1 font-mono uppercase tracking-widest">{coupleName}</Badge>
          </header>
          
          <div className="text-center space-y-4">
            <div className="mx-auto bg-primary/5 w-32 h-32 rounded-full flex items-center justify-center shadow-inner">
              <Heart className="w-16 h-16 text-primary fill-primary/10" />
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-primary">Afu & Ruovaf</h1>
              <p className="text-muted-foreground">
                {tempRole ? `Secure access for ${tempRole === 'afu' ? 'Afu' : 'Ruovaf'}` : "Welcome! Who is checking in today?"}
              </p>
            </div>
          </div>

          {!tempRole ? (
            <div className="grid gap-4">
              <Button
                size="lg"
                variant="outline"
                className="h-28 text-2xl border-primary/10 hover:border-primary/40 hover:bg-primary/5 group rounded-3xl transition-all duration-300"
                onClick={() => handlePartnerSelect('afu')}
              >
                <div className="flex items-center justify-between w-full px-6">
                  <span className="font-bold">Afu</span>
                  <Badge variant={afuData?.password ? "default" : "outline"} className="ml-2 bg-primary/10 text-primary border-none">
                    {afuData?.password ? "Active" : "New"}
                  </Badge>
                  <ChevronRight className="w-6 h-6 text-primary/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-28 text-2xl border-primary/10 hover:border-primary/40 hover:bg-primary/5 group rounded-3xl transition-all duration-300"
                onClick={() => handlePartnerSelect('ruovaf')}
              >
                <div className="flex items-center justify-between w-full px-6">
                  <span className="font-bold">Ruovaf</span>
                  <Badge variant={ruovafData?.password ? "default" : "outline"} className="ml-2 bg-primary/10 text-primary border-none">
                    {ruovafData?.password ? "Active" : "New"}
                  </Badge>
                  <ChevronRight className="w-6 h-6 text-primary/20 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </Button>
            </div>
          ) : (
            <Card className="border-none shadow-2xl bg-white/80 backdrop-blur-xl rounded-3xl overflow-hidden">
              <div className="h-1.5 w-full bg-primary/20" />
              <CardContent className="p-8 space-y-6">
                {roleLoading ? (
                  <div className="flex flex-col items-center py-8 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Verifying partner...</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          {targetData?.password ? "Enter Password" : "Set New Password"}
                        </Label>
                        <Input 
                          id="password" 
                          type="password" 
                          placeholder="••••••" 
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          className="h-12 text-lg rounded-xl border-primary/20 focus-visible:ring-primary"
                          onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                        />
                      </div>
                      {!targetData?.password && (
                        <div className="space-y-2 fade-in">
                          <Label htmlFor="confirm-password" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Confirm Password</Label>
                          <Input 
                            id="confirm-password" 
                            type="password" 
                            placeholder="••••••" 
                            value={confirmPasswordInput}
                            onChange={(e) => setConfirmPasswordInput(e.target.value)}
                            className="h-12 text-lg rounded-xl border-primary/20 focus-visible:ring-primary"
                            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button variant="ghost" className="flex-1 h-12 rounded-xl" onClick={() => setTempRole(null)}>Cancel</Button>
                      <Button className="flex-1 h-12 rounded-xl shadow-lg shadow-primary/20" onClick={handleAuth}>
                        {targetData?.password ? "Enter" : "Initialize"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  const currentPartner = activeRole === 'afu' ? afuData : ruovafData;
  const otherPartner = activeRole === 'afu' ? ruovafData : afuData;
  const todayStr = getTodayStr();

  // Reset local counts if the day has changed but UI hasn't re-synced yet
  const myTodayCount = currentPartner?.lastUpdateDate === todayStr ? (currentPartner?.currentSmileCount || 0) : 0;
  const otherTodayCount = otherPartner?.lastUpdateDate === todayStr ? (otherPartner?.currentSmileCount || 0) : 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b px-4 h-16 flex items-center justify-between shadow-sm">
        <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <span className="font-bold text-primary flex items-center gap-2 text-lg">
          <Smile className="w-5 h-5" />
          Afu & Ruovaf
        </span>
        <div className="text-[10px] font-bold text-muted-foreground uppercase opacity-40 tracking-widest">{coupleName}</div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        <section className="text-center space-y-8 pt-10 relative">
          <div className="relative inline-block">
            <button
              onClick={handleIncrement}
              className="w-56 h-56 rounded-full bg-primary text-primary-foreground shadow-2xl flex flex-col items-center justify-center smile-button-pop relative z-10 hover:shadow-primary/40 active:scale-95 transition-all"
            >
              <Heart className="w-14 h-14 mb-2 fill-current" />
              <span className="text-6xl font-extrabold tabular-nums tracking-tighter">{myTodayCount}</span>
              <span className="text-xs font-bold uppercase tracking-[0.2em] mt-2 opacity-90">Smiles Today</span>
            </button>
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping z-0 scale-110" />
          </div>
          <p className="text-muted-foreground font-medium text-lg">Tap to share a smile with {otherPartner?.displayName || (activeRole === 'afu' ? 'Ruovaf' : 'Afu')}</p>
        </section>

        {(aiPrompt || isLoadingPrompt) && (
          <div className="fade-in px-2">
            <Card className="border-none shadow-xl bg-primary/5 rounded-3xl overflow-hidden border-l-4 border-l-primary">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-2.5 rounded-2xl">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/60">Loving Thought</p>
                    {isLoadingPrompt ? (
                      <div className="space-y-2 py-1">
                        <div className="h-4 w-full bg-primary/10 animate-pulse rounded-full" />
                        <div className="h-4 w-2/3 bg-primary/10 animate-pulse rounded-full" />
                      </div>
                    ) : (
                      <p className="text-foreground leading-relaxed italic text-lg">{aiPrompt}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted/40 p-1.5 h-14 rounded-2xl">
            <TabsTrigger value="dashboard" className="rounded-xl data-[state=active]:shadow-md">
              <Users className="w-4 h-4 mr-2" />
              Home
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl data-[state=active]:shadow-md">
              <History className="w-4 h-4 mr-2" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl data-[state=active]:shadow-md">
              <Settings className="w-4 h-4 mr-2" />
              Set
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6 space-y-4 fade-in">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-white/60 backdrop-blur-xl border-none shadow-lg rounded-3xl p-2">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">My Smiles</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-primary tabular-nums">{myTodayCount}</span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/20 text-primary uppercase font-bold">Live</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/60 backdrop-blur-xl border-none shadow-lg rounded-3xl p-2">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{otherPartner?.displayName || (activeRole === 'afu' ? 'Ruovaf' : 'Afu')}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {otherPartner?.visibilityEnabled ? (
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-black text-secondary tabular-nums">{otherTodayCount}</span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-secondary/20 text-secondary uppercase font-bold">Shared</Badge>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 h-10 text-muted-foreground/30">
                      <EyeOff className="w-5 h-5" />
                      <span className="text-sm font-medium italic">Hidden</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6 fade-in">
            <Card className="bg-white/60 backdrop-blur-xl border-none shadow-lg rounded-3xl overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold">Recent Memories</CardTitle>
                <CardDescription>A journey of your recorded smiles</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-72 px-6 pb-6">
                  <div className="space-y-4">
                    {smileHistory?.map((record) => (
                      <div key={record.id} className="flex items-center justify-between py-4 border-b border-primary/5 last:border-none group">
                        <div className="space-y-1">
                          <p className="font-bold text-foreground/80">{new Date(record.recordDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Daily Total</p>
                        </div>
                        <div className="flex items-center gap-3">
                           <Badge className="bg-primary/10 text-primary font-black text-lg h-10 w-10 flex items-center justify-center rounded-2xl border-none">
                            {record.smileCount}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/20 group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    ))}
                    {(!smileHistory || smileHistory.length === 0) && (
                      <div className="text-center py-16 space-y-3">
                        <div className="bg-muted/30 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                          <History className="w-6 h-6 text-muted-foreground/40" />
                        </div>
                        <p className="text-muted-foreground font-medium italic">Your journey begins with your first smile.</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-6 fade-in space-y-6 pb-10">
             <Card className="bg-white/60 backdrop-blur-xl border-none shadow-lg rounded-3xl overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold">Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="flex items-center justify-between group">
                  <div className="space-y-1">
                    <Label className="text-lg font-bold">Smile Visibility</Label>
                    <p className="text-sm text-muted-foreground">Let {otherPartner?.displayName || 'your partner'} see your count</p>
                  </div>
                  <Switch 
                    checked={!!currentPartner?.visibilityEnabled} 
                    onCheckedChange={toggleVisibility}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
                
                <Separator className="bg-primary/5" />

                <div className="space-y-4">
                   <Label className="text-sm font-bold uppercase tracking-[0.2em] text-primary/60">Your Profile</Label>
                   <div className="flex items-center gap-4 bg-primary/5 p-5 rounded-3xl border border-primary/10">
                      <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-2xl font-black shadow-lg shadow-primary/20">
                        {currentPartner?.displayName?.charAt(0) || activeRole?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-xl font-extrabold text-foreground">{currentPartner?.displayName}</p>
                        <p className="text-xs font-bold text-primary/60 uppercase tracking-widest">{coupleName} pair</p>
                      </div>
                   </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/60 backdrop-blur-xl border-none shadow-lg rounded-3xl overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  Security
                </CardTitle>
                <CardDescription>Update your secure access password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input 
                      id="new-password" 
                      type="password" 
                      placeholder="••••••" 
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="h-12 rounded-xl border-primary/20 focus-visible:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                    <Input 
                      id="confirm-new-password" 
                      type="password" 
                      placeholder="••••••" 
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      className="h-12 rounded-xl border-primary/20 focus-visible:ring-primary"
                    />
                  </div>
                </div>
                <Button className="w-full h-12 rounded-xl shadow-lg shadow-primary/20 font-bold" onClick={handlePasswordChange}>
                  Update Password
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
