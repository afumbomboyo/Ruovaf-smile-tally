"use client"

import React, { useState, useEffect } from 'react';
import { PartnerId, AppState, PartnerData } from '@/app/lib/types';
import { generateLovingPrompt } from '@/ai/flows/ai-generated-smile-prompt';
import { 
  Heart, 
  Smile, 
  Users, 
  Settings, 
  History, 
  Eye, 
  EyeOff, 
  ArrowLeft,
  Sparkles,
  ChevronRight,
  Lock,
  KeyRound
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

const STORAGE_KEY = 'ruovaf-smile-tally-v2';

const INITIAL_STATE: AppState = {
  partners: {
    'partner-1': {
      id: 'partner-1',
      name: 'Partner One',
      isVisible: true,
      smileHistory: {}
    },
    'partner-2': {
      id: 'partner-2',
      name: 'Partner Two',
      isVisible: true,
      smileHistory: {}
    }
  }
};

export default function RuovafApp() {
  const { toast } = useToast();
  const [activePartnerId, setActivePartnerId] = useState<PartnerId | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [isHydrated, setIsHydrated] = useState(false);
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);

  // Auth/Setup form state
  const [tempId, setTempId] = useState<PartnerId | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setState(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved state", e);
      }
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isHydrated]);

  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const handleIncrement = async () => {
    if (!activePartnerId || !isAuthenticated) return;

    const today = getTodayStr();
    setState(prev => {
      const partner = prev.partners[activePartnerId];
      const newHistory = { ...partner.smileHistory };
      newHistory[today] = (newHistory[today] || 0) + 1;

      return {
        ...prev,
        partners: {
          ...prev.partners,
          [activePartnerId]: {
            ...partner,
            smileHistory: newHistory
          }
        }
      };
    });

    setIsLoadingPrompt(true);
    try {
      const result = await generateLovingPrompt({});
      setAiPrompt(result.prompt);
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  const toggleVisibility = (id: PartnerId) => {
    setState(prev => ({
      ...prev,
      partners: {
        ...prev.partners,
        [id]: {
          ...prev.partners[id],
          isVisible: !prev.partners[id].isVisible
        }
      }
    }));
  };

  const handlePartnerSelect = (id: PartnerId) => {
    const partner = state.partners[id];
    setTempId(id);
    setPasswordInput('');
    setConfirmPasswordInput('');
    
    // If no password set, we'll show the setup screen
    // If password exists, we'll show the login screen
  };

  const handleAuth = () => {
    if (!tempId) return;
    const partner = state.partners[tempId];

    if (!partner.password) {
      // First time setup
      if (passwordInput.length < 4) {
        toast({ variant: "destructive", title: "Error", description: "Password must be at least 4 characters." });
        return;
      }
      if (passwordInput !== confirmPasswordInput) {
        toast({ variant: "destructive", title: "Error", description: "Passwords do not match." });
        return;
      }

      setState(prev => ({
        ...prev,
        partners: {
          ...prev.partners,
          [tempId]: { ...prev.partners[tempId], password: passwordInput }
        }
      }));
      setActivePartnerId(tempId);
      setIsAuthenticated(true);
      setTempId(null);
    } else {
      // Login
      if (passwordInput === partner.password) {
        setActivePartnerId(tempId);
        setIsAuthenticated(true);
        setTempId(null);
      } else {
        toast({ variant: "destructive", title: "Access Denied", description: "Incorrect password." });
      }
    }
  };

  const handlePasswordChange = () => {
    if (!activePartnerId) return;
    if (passwordInput.length < 4) {
      toast({ variant: "destructive", title: "Error", description: "Password must be at least 4 characters." });
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      toast({ variant: "destructive", title: "Error", description: "Passwords do not match." });
      return;
    }

    setState(prev => ({
      ...prev,
      partners: {
        ...prev.partners,
        [activePartnerId]: { ...prev.partners[activePartnerId], password: passwordInput }
      }
    }));
    toast({ title: "Success", description: "Password updated successfully." });
    setPasswordInput('');
    setConfirmPasswordInput('');
  };

  const handleLogout = () => {
    setActivePartnerId(null);
    setIsAuthenticated(false);
    setAiPrompt(null);
    setTempId(null);
  };

  if (!isHydrated) return null;

  // Authentication or Selection Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8 fade-in">
          <div className="text-center space-y-2">
            <div className="mx-auto bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mb-6">
              <Heart className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-primary">Afu & Ruovaf</h1>
            <p className="text-muted-foreground">
              {tempId ? `Secure access for ${state.partners[tempId].name}` : "Welcome! Who is checking in?"}
            </p>
          </div>

          {!tempId ? (
            <div className="grid gap-4">
              {Object.values(state.partners).map((partner) => (
                <Button
                  key={partner.id}
                  size="lg"
                  variant="outline"
                  className="h-24 text-xl border-primary/20 hover:border-primary hover:bg-primary/5 group"
                  onClick={() => handlePartnerSelect(partner.id)}
                >
                  <div className="flex items-center justify-between w-full px-4">
                    <span className="font-semibold">{partner.name}</span>
                    <ChevronRight className="w-6 h-6 text-primary/40 group-hover:text-primary transition-colors" />
                  </div>
                </Button>
              ))}
            </div>
          ) : (
            <Card className="border-none shadow-xl bg-white/50 backdrop-blur-sm">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">
                    {state.partners[tempId].password ? "Enter Password" : "Set New Password"}
                  </Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••" 
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                  />
                </div>
                {!state.partners[tempId].password && (
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
                  <Button variant="ghost" className="flex-1" onClick={() => setTempId(null)}>Cancel</Button>
                  <Button className="flex-1" onClick={handleAuth}>
                    {state.partners[tempId].password ? "Enter" : "Initialize"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  const today = getTodayStr();
  const currentPartner = state.partners[activePartnerId!];
  const otherPartnerId = activePartnerId === 'partner-1' ? 'partner-2' : 'partner-1';
  const otherPartner = state.partners[otherPartnerId];
  const myTodayCount = currentPartner.smileHistory[today] || 0;
  const otherTodayCount = otherPartner.smileHistory[today] || 0;

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
        <div className="w-10" />
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {/* Main Action Counter - Lower Z-Index to scroll under header */}
        <section className="text-center space-y-6 pt-4 relative z-0">
          <div className="relative inline-block">
            <button
              onClick={handleIncrement}
              className="w-48 h-48 rounded-full bg-primary text-primary-foreground shadow-2xl flex flex-col items-center justify-center smile-button-pop relative z-10"
            >
              <Heart className="w-12 h-12 mb-2 fill-current" />
              <span className="text-4xl font-bold">{myTodayCount}</span>
              <span className="text-sm font-medium opacity-80 uppercase tracking-widest mt-1">Today</span>
            </button>
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping -z-0" />
          </div>
          <p className="text-muted-foreground font-medium">Tap to record a smile for {otherPartner.name}</p>
        </section>

        {/* AI Prompt Section */}
        { (aiPrompt || isLoadingPrompt) && (
          <div className="fade-in relative z-10">
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

        <Tabs defaultValue="dashboard" className="w-full relative z-10">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 h-12 rounded-xl">
            <TabsTrigger value="dashboard" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Users className="w-4 h-4 mr-2" />
              Home
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <History className="w-4 h-4 mr-2" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
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
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{otherPartner.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {otherPartner.isVisible ? (
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
                    {Object.entries(currentPartner.smileHistory)
                      .sort(([a], [b]) => b.localeCompare(a))
                      .map(([date, count]) => (
                        <div key={date} className="flex items-center justify-between py-2 border-b last:border-none">
                          <div className="space-y-0.5">
                            <p className="font-medium">{new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            <p className="text-xs text-muted-foreground">Recorded smiles</p>
                          </div>
                          <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-3 font-bold">
                            {count}
                          </Badge>
                        </div>
                      ))}
                    {Object.keys(currentPartner.smileHistory).length === 0 && (
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
                    <p className="text-sm text-muted-foreground">Allow {otherPartner.name} to see your daily count</p>
                  </div>
                  <Switch 
                    checked={currentPartner.isVisible} 
                    onCheckedChange={() => toggleVisibility(activePartnerId!)}
                  />
                </div>
                
                <Separator />

                <div className="space-y-4">
                   <Label className="text-base block">User Profile</Label>
                   <div className="flex items-center gap-4 bg-muted/20 p-4 rounded-xl">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                        {currentPartner.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold">{currentPartner.name}</p>
                        <p className="text-xs text-muted-foreground">Connected & Authenticated</p>
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
