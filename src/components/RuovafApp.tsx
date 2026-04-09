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
  Lock
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
  useUser
} from '@/firebase';
import { doc, collection, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';

type PartnerRole = 'afu' | 'ruovaf';

export default function RuovafApp() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user, isUserLoading: isAuthLoading } = useUser();
  const [activeRole, setActiveRole] = useState<PartnerRole | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);

  // Grouping state to support multiple couples
  const [coupleName, setCoupleName] = useState('');
  const [isCoupleSet, setIsCoupleSet] = useState(false);

  // Auth/Setup form state
  const [tempRole, setTempRole] = useState<PartnerRole | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

  // Firebase Auth - Anonymous sign-in for Firestore access
  useEffect(() => {
    const { auth } = require('@/firebase');
    if (auth && !user && !isAuthLoading) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isAuthLoading]);

  // Firestore Data References - These should only depend on coupleName to be available for auth
  const afuRef = useMemoFirebase(() => {
    if (!coupleName) return null;
    return doc(db, 'partners', `${coupleName}_afu`);
  }, [db, coupleName]);
  const { data: afuData } = useDoc(afuRef);

  const ruovafRef = useMemoFirebase(() => {
    if (!coupleName) return null;
    return doc(db, 'partners', `${coupleName}_ruovaf`);
  }, [db, coupleName]);
  const { data: ruovafData } = useDoc(ruovafRef);

  // History for active user
  const historyQuery = useMemoFirebase(() => {
    if (!activeRole || !coupleName) return null;
    return query(
      collection(db, 'partners', `${coupleName}_${activeRole}`, 'dailySmileRecords'),
      orderBy('recordDate', 'desc'),
      limit(30)
    );
  }, [db, activeRole, coupleName]);
  const { data: smileHistory } = useCollection(historyQuery);

  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const handleIncrement = async () => {
    if (!activeRole || !isAuthenticated || !coupleName) return;

    const today = getTodayStr();
    const currentRef = activeRole === 'afu' ? afuRef : ruovafRef;
    const currentData = activeRole === 'afu' ? afuData : ruovafData;

    if (!currentRef) return;

    const newCount = (currentData?.currentSmileCount || 0) + 1;
    
    updateDocumentNonBlocking(currentRef, {
      currentSmileCount: newCount,
      lastLoginAt: serverTimestamp()
    });

    const historyRef = doc(db, 'partners', `${coupleName}_${activeRole}`, 'dailySmileRecords', today);
    setDocumentNonBlocking(historyRef, {
      recordDate: today,
      smileCount: newCount,
      updatedAt: serverTimestamp()
    }, { merge: true });

    setIsLoadingPrompt(true);
    try {
      const result = await generateLovingPrompt({});
      setAiPrompt(result.prompt);
    } catch (error) {
      // Error handled by AI flow
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  const toggleVisibility = () => {
    if (!activeRole || !afuRef || !ruovafRef) return;
    const currentRef = activeRole === 'afu' ? afuRef : ruovafRef;
    const currentData = activeRole === 'afu' ? afuData : ruovafData;
    
    updateDocumentNonBlocking(currentRef, {
      visibilityEnabled: !currentData?.visibilityEnabled
    });
  };

  const handlePartnerSelect = (role: PartnerRole) => {
    setTempRole(role);
    setPasswordInput('');
    setConfirmPasswordInput('');
  };

  const handleAuth = () => {
    if (!tempRole || !afuRef || !ruovafRef) return;
    const roleData = tempRole === 'afu' ? afuData : ruovafData;
    const roleRef = tempRole === 'afu' ? afuRef : ruovafRef;

    if (!roleData || !roleData.password) {
      if (passwordInput.length < 4) {
        toast({ variant: "destructive", title: "Error", description: "Password must be at least 4 characters." });
        return;
      }
      if (passwordInput !== confirmPasswordInput) {
        toast({ variant: "destructive", title: "Error", description: "Passwords do not match." });
        return;
      }

      setDocumentNonBlocking(roleRef, {
        id: tempRole,
        displayName: tempRole === 'afu' ? 'Afu' : 'Ruovaf',
        password: passwordInput,
        currentSmileCount: 0,
        visibilityEnabled: true,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        partneredWithId: tempRole === 'afu' ? 'ruovaf' : 'afu'
      }, { merge: true });

      setActiveRole(tempRole);
      setIsAuthenticated(true);
      setTempRole(null);
    } else {
      if (passwordInput === roleData.password) {
        setActiveRole(tempRole);
        setIsAuthenticated(true);
        setTempRole(null);
        updateDocumentNonBlocking(roleRef, { lastLoginAt: serverTimestamp() });
      } else {
        toast({ variant: "destructive", title: "Access Denied", description: "Incorrect password." });
      }
    }
  };

  const handlePasswordChange = () => {
    if (!activeRole || !afuRef || !ruovafRef) return;
    const roleRef = activeRole === 'afu' ? afuRef : ruovafRef;

    if (passwordInput.length < 4) {
      toast({ variant: "destructive", title: "Error", description: "Password must be at least 4 characters." });
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      toast({ variant: "destructive", title: "Error", description: "Passwords do not match." });
      return;
    }

    updateDocumentNonBlocking(roleRef, { password: passwordInput });
    toast({ title: "Success", description: "Password updated successfully." });
    setPasswordInput('');
    setConfirmPasswordInput('');
  };

  const handleLogout = () => {
    setActiveRole(null);
    setIsAuthenticated(false);
    setAiPrompt(null);
    setTempRole(null);
    setIsCoupleSet(false);
  };

  if (isAuthLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  // Initial Couple Selection
  if (!isCoupleSet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8 fade-in text-center">
          <div className="mx-auto bg-primary/10 w-40 h-40 rounded-full flex items-center justify-center mb-8 shadow-inner">
            <Heart className="w-20 h-20 text-primary animate-pulse fill-primary/20" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-primary">Afu & Ruovaf</h1>
          <p className="text-muted-foreground">Welcome! Enter your unique Couple Name to begin.</p>
          <div className="space-y-4">
            <Input 
              placeholder="e.g. OurSweetHome" 
              value={coupleName}
              onChange={(e) => setCoupleName(e.target.value.toLowerCase().trim())}
              className="text-center h-12 text-lg"
            />
            <Button 
              className="w-full h-12 text-lg" 
              disabled={!coupleName}
              onClick={() => setIsCoupleSet(true)}
            >
              Enter Shared Journey
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Authentication or Selection Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8 fade-in">
          <header className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="icon" onClick={() => setIsCoupleSet(false)}>
               <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{coupleName}</span>
          </header>
          
          <div className="text-center space-y-2">
            <div className="mx-auto bg-primary/10 w-32 h-32 rounded-full flex items-center justify-center mb-8 shadow-inner">
              <Heart className="w-16 h-16 text-primary animate-pulse fill-primary/20" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Afu & Ruovaf</h1>
            <p className="text-muted-foreground">
              {tempRole ? `Secure access for ${tempRole === 'afu' ? 'Afu' : 'Ruovaf'}` : "Welcome! Who is checking in?"}
            </p>
          </div>

          {!tempRole ? (
            <div className="grid gap-4">
              <Button
                size="lg"
                variant="outline"
                className="h-24 text-xl border-primary/20 hover:border-primary hover:bg-primary/5 group"
                onClick={() => handlePartnerSelect('afu')}
              >
                <div className="flex items-center justify-between w-full px-4">
                  <span className="font-semibold">Afu</span>
                  <Badge variant={afuData?.password ? "secondary" : "outline"} className="ml-2">
                    {afuData?.password ? "Active" : "New"}
                  </Badge>
                  <ChevronRight className="w-6 h-6 text-primary/40 group-hover:text-primary transition-colors" />
                </div>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-24 text-xl border-primary/20 hover:border-primary hover:bg-primary/5 group"
                onClick={() => handlePartnerSelect('ruovaf')}
              >
                <div className="flex items-center justify-between w-full px-4">
                  <span className="font-semibold">Ruovaf</span>
                  <Badge variant={ruovafData?.password ? "secondary" : "outline"} className="ml-2">
                    {ruovafData?.password ? "Active" : "New"}
                  </Badge>
                  <ChevronRight className="w-6 h-6 text-primary/40 group-hover:text-primary transition-colors" />
                </div>
              </Button>
            </div>
          ) : (
            <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">
                    {((tempRole === 'afu' ? afuData : ruovafData)?.password) ? "Enter Password" : "Set New Password"}
                  </Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                  />
                </div>
                {!((tempRole === 'afu' ? afuData : ruovafData)?.password) && (
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input 
                      id="confirm-password" 
                      type="password" 
                      placeholder="••••••" 
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    />
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setTempRole(null)}>Cancel</Button>
                  <Button className="flex-1" onClick={handleAuth}>
                    {((tempRole === 'afu' ? afuData : ruovafData)?.password) ? "Enter" : "Initialize"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  const currentPartner = activeRole === 'afu' ? afuData : ruovafData;
  const otherPartner = activeRole === 'afu' ? ruovafData : afuData;
  const myTodayCount = currentPartner?.currentSmileCount || 0;
  const otherTodayCount = otherPartner?.currentSmileCount || 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-4 h-16 flex items-center justify-between shadow-sm">
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <span className="font-bold text-primary flex items-center gap-2">
          <Smile className="w-5 h-5" />
          Afu & Ruovaf
        </span>
        <div className="text-xs font-bold text-muted-foreground uppercase opacity-40">{coupleName}</div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        <section className="text-center space-y-6 pt-4 relative">
          <div className="relative inline-block">
            <button
              onClick={handleIncrement}
              className="w-48 h-48 rounded-full bg-primary text-primary-foreground shadow-2xl flex flex-col items-center justify-center smile-button-pop relative z-10"
            >
              <Heart className="w-12 h-12 mb-2 fill-current" />
              <span className="text-4xl font-bold">{myTodayCount}</span>
              <span className="text-sm font-medium opacity-80 uppercase tracking-widest mt-1">Today</span>
            </button>
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping z-0" />
          </div>
          <p className="text-muted-foreground font-medium">Tap to record a smile for {otherPartner?.displayName || (activeRole === 'afu' ? 'Ruovaf' : 'Afu')}</p>
        </section>

        {(aiPrompt || isLoadingPrompt) && (
          <div className="fade-in">
            <Card className="border-none shadow-lg bg-secondary/10 overflow-hidden">
              <div className="bg-secondary h-1" />
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-secondary/20 p-2 rounded-lg">
                    <Sparkles className="w-5 h-5 text-secondary" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-secondary">Loving Thought</p>
                    {isLoadingPrompt ? (
                      <div className="h-4 w-full bg-secondary/10 animate-pulse rounded" />
                    ) : (
                      <p className="text-foreground leading-relaxed italic">{aiPrompt}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 h-12 rounded-xl">
            <TabsTrigger value="dashboard" className="rounded-lg">
              <Users className="w-4 h-4 mr-2" />
              Home
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg">
              <History className="w-4 h-4 mr-2" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg">
              <Settings className="w-4 h-4 mr-2" />
              Set
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6 space-y-4 fade-in">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-white/50 backdrop-blur-sm border-none shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">My Smiles</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-primary">{myTodayCount}</span>
                    <Badge variant="outline" className="text-[10px] py-0 border-primary/20 text-primary">Live</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/50 backdrop-blur-sm border-none shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{otherPartner?.displayName || (activeRole === 'afu' ? 'Ruovaf' : 'Afu')}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {otherPartner?.visibilityEnabled ? (
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-bold text-secondary">{otherTodayCount}</span>
                      <Badge variant="outline" className="text-[10px] py-0 border-secondary/20 text-secondary">Visible</Badge>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 h-9 text-muted-foreground/50">
                      <EyeOff className="w-4 h-4" />
                      <span className="text-sm italic">Hidden</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-6 fade-in">
            <Card className="bg-white/50 backdrop-blur-sm border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Recent Memories</CardTitle>
                <CardDescription>Your history of recorded smiles</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-64 px-6 pb-6">
                  <div className="space-y-4">
                    {smileHistory?.map((record) => (
                      <div key={record.recordDate} className="flex items-center justify-between py-2 border-b last:border-none">
                        <div className="space-y-0.5">
                          <p className="font-medium">{new Date(record.recordDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          <p className="text-xs text-muted-foreground">Daily total</p>
                        </div>
                        <Badge className="bg-primary/10 text-primary font-bold">
                          {record.smileCount}
                        </Badge>
                      </div>
                    ))}
                    {(!smileHistory || smileHistory.length === 0) && (
                      <div className="text-center py-12 text-muted-foreground italic">
                        No records yet. Start smiling!
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-6 fade-in space-y-6">
             <Card className="bg-white/50 backdrop-blur-sm border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Smile Visibility</Label>
                    <p className="text-sm text-muted-foreground">Allow {otherPartner?.displayName || 'your partner'} to see your daily count</p>
                  </div>
                  <Switch 
                    checked={!!currentPartner?.visibilityEnabled} 
                    onCheckedChange={toggleVisibility}
                  />
                </div>
                
                <Separator />

                <div className="space-y-4">
                   <Label className="text-base block">User Profile</Label>
                   <div className="flex items-center gap-4 bg-muted/20 p-4 rounded-xl">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                        {currentPartner?.displayName?.charAt(0) || activeRole?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold">{currentPartner?.displayName}</p>
                        <p className="text-xs text-muted-foreground">Pair: {coupleName}</p>
                      </div>
                   </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/50 backdrop-blur-sm border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Security
                </CardTitle>
                <CardDescription>Update your access password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input 
                    id="new-password" 
                    type="password" 
                    placeholder="••••••" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
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
                  />
                </div>
                <Button className="w-full" onClick={handlePasswordChange}>
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