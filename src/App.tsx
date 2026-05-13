import { useState, useEffect } from 'react';
import OutreachForm from './components/OutreachForm';
import MessageDisplay from './components/MessageDisplay';
import ProfileTable from './components/ProfileTable';
import { generateOutreach, bulkGenerateOutreach, type OutreachContent } from './services/geminiService';
import { Linkedin, Zap, LogIn, LogOut, User as UserIcon, List, Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, signIn, sign_out, saveProfile, getProfiles } from './lib/supabase';
import { exportToCSV } from './lib/export';
import type { User } from '@supabase/supabase-js';

export default function App() {
  const [outreach, setOutreach] = useState<OutreachContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [view, setView] = useState<'generate' | 'archive'>('generate');
  
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [user]);

  const loadProfiles = async () => {
    try {
      const data = await getProfiles();
      setProfiles(data || []);
    } catch (err) {
      console.error("Error fetching profiles:", err);
    }
  };

  const handleGenerate = async (urls: string[]) => {
    setIsLoading(true);
    setError(null);
    setOutreach(null);
    setBulkProgress({ current: 0, total: urls.length });

    try {
      if (urls.length === 1) {
        const result = await generateOutreach(urls[0]);
        setOutreach(result);
        await saveProfile(result);
      } else {
        const results = await bulkGenerateOutreach(urls, (current, total) => {
          setBulkProgress({ current, total });
        });
        
        for (const res of results) {
          await saveProfile(res);
        }
        
        if (results.length > 0) {
          setOutreach(results[results.length - 1]); // Show last result
          setView('archive'); // Go to archive to see all
        }
      }
      loadProfiles();
    } catch (err) {
      setError('System failure. Verify API connection and try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
      setBulkProgress({ current: 0, total: 0 });
    }
  };

  const handleExport = () => {
    exportToCSV(profiles, `linkforge_export_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-accent selection:text-black">
      {/* Header */}
      <header className="border-b-4 border-black sticky top-0 bg-white z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-black p-2 transform -rotate-3">
              <Linkedin className="w-6 h-6 text-accent" />
            </div>
            <span className="font-black text-2xl tracking-tighter uppercase italic">LinkForge</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] mr-8">
              <button 
                onClick={() => setView('generate')}
                className={`hover:text-accent transition-colors flex items-center gap-2 ${view === 'generate' ? 'text-accent underline decoration-4 underline-offset-8' : ''}`}
              >
                <Search className="w-3 h-3" /> Synthesis
              </button>
              <button 
                onClick={() => setView('archive')}
                className={`hover:text-accent transition-colors flex items-center gap-2 ${view === 'archive' ? 'text-accent underline decoration-4 underline-offset-8' : ''}`}
              >
                <List className="w-3 h-3" /> Archive
              </button>
            </div>

            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-black text-white px-4 py-2 border-2 border-black">
                  <UserIcon className="w-4 h-4 text-accent" />
                  <span className="text-[10px] font-black uppercase truncate max-w-[100px]">{user.email}</span>
                </div>
                <button 
                   onClick={sign_out}
                   className="bg-white text-black p-2 border-2 border-black hover:bg-black hover:text-white transition-all"
                   title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-black text-white px-4 py-2 border-2 border-black opacity-60">
                 <UserIcon className="w-4 h-4 text-accent/50" />
                 <span className="text-[10px] font-black uppercase">Guest Console</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto min-h-[calc(100vh-80px)]">
        {view === 'generate' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 h-screen max-h-[calc(100vh-80px)]">
            {/* Left Console: Input Form */}
            <section className="lg:col-span-4 border-r-0 lg:border-r-4 border-black p-8 lg:p-12 space-y-12 overflow-y-auto">
              <div className="space-y-4">
                <div className="bg-accent inline-block px-2 py-1 text-[10px] font-black uppercase tracking-widest border border-black transform rotate-1">
                  Agent Uplink Stable
                </div>
                <h1 className="text-6xl md:text-7xl font-black leading-none tracking-tighter uppercase">
                  Target <br/> Search
                </h1>
                <p className="text-sm font-medium leading-relaxed opacity-60 max-w-md uppercase tracking-tight">
                  FEED THE SYSTEM WITH A LINKEDIN URL. OUR SEARCH MODULE WILL RECONNAISSANCE CORE METRICS.
                </p>
              </div>

              <OutreachForm onGenerate={handleGenerate} isLoading={isLoading} />
              
              {error && (
                <motion.div 
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="p-4 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xs font-bold font-mono flex items-center gap-3"
                >
                  <div className="w-3 h-3 bg-red-500 border border-black shrink-0" />
                  {error}
                </motion.div>
              )}
            </section>

            {/* Right Console: Results */}
            <section className="lg:col-span-8 bg-[#F0F0F0] p-8 lg:p-12 relative overflow-y-auto">
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, black 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
              
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center text-center space-y-8"
                  >
                    <div className="relative">
                      <div className="w-32 h-32 border-[12px] border-black border-t-accent animate-spin" />
                      {bulkProgress.total > 1 && (
                        <div className="absolute inset-0 flex items-center justify-center font-black text-xl">
                          {bulkProgress.current}/{bulkProgress.total}
                        </div>
                      )}
                    </div>
                    <div className="space-y-4 max-w-md">
                      <h2 className="text-4xl font-black uppercase tracking-tighter italic">
                        {bulkProgress.total > 1 ? `Bulk Extraction Active` : `Scanning Web`}
                      </h2>
                      <p className="text-[10px] font-mono font-black opacity-40 uppercase">
                        {bulkProgress.total > 1 
                          ? `PROCESSING TARGET ${bulkProgress.current} OF ${bulkProgress.total} / ENFORCING GROUNDING PROTOCOLS`
                          : `Crawling Digital Footprint / Resolving URL Hierarchy / Bypassing Gatekeepers`}
                      </p>
                      
                      {bulkProgress.total > 1 && (
                        <div className="w-full h-4 bg-black/10 border-2 border-black overflow-hidden">
                          <motion.div 
                            className="h-full bg-accent"
                            initial={{ width: 0 }}
                            animate={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : outreach ? (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-12"
                  >
                    <div className="flex items-end justify-between border-b-4 border-black pb-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-accent bg-black inline-block w-fit px-2 py-0.5 mb-2">Extraction Succeeded</span>
                        <h2 className="text-5xl font-black uppercase tracking-tighter italic">Synthesis Result</h2>
                      </div>
                      <button 
                        onClick={() => setOutreach(null)}
                        className="text-[10px] font-black uppercase tracking-widest border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-all bg-white"
                      >
                        Reset Module
                      </button>
                    </div>
                    <MessageDisplay content={outreach} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center text-center space-y-12"
                  >
                    <div className="relative">
                      <Zap className="w-32 h-32 text-black opacity-10 absolute -top-8 -left-8 -rotate-12" />
                      <div className="border-4 border-black p-12 bg-white shadow-[20px_20px_0px_0px_#D4FF3F] relative">
                        <h3 className="text-4xl font-black uppercase tracking-tighter italic mb-4">Awaiting Signal</h3>
                        <p className="text-[10px] font-black max-w-xs mx-auto uppercase tracking-widest opacity-40">
                          INPUT PROFILE URL IN THE LEFT CONSOLE TO ACTIVATE GROUNDING MODULE.
                        </p>
                      </div>
                    </div>
                    
                    <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        { label: 'Search', desc: 'Deep Web Recon' },
                        { label: 'Analyze', desc: 'Context Resolve' },
                        { label: 'Synth', desc: 'Outreach Build' }
                      ].map((step, i) => (
                        <div key={i} className="border-4 border-black p-6 bg-white text-left shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                          <div className="text-[10px] font-black uppercase mb-1">Module 0{i+1}</div>
                          <div className="text-xl font-black uppercase italic mb-2 tracking-tighter">{step.label}</div>
                          <div className="h-1 w-full bg-accent" />
                          <div className="text-[8px] font-black uppercase mt-2 opacity-30">{step.desc}</div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>
        ) : (
          <section className="p-8 lg:p-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ProfileTable 
              profiles={profiles} 
              onSelect={(p) => {
                setOutreach(p);
                setView('generate');
              }} 
              onExport={handleExport}
            />
            {profiles.length === 0 && (
              <div className="h-[60vh] flex flex-col items-center justify-center border-4 border-dashed border-black/20 rounded-lg">
                <div className="text-4xl font-black uppercase italic text-black/10">Archive Empty</div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-30 mt-4 underline cursor-pointer" onClick={() => setView('generate')}>Start first synthesis</p>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer / Status Bar */}
      <footer className="border-t-4 border-black p-4 bg-accent sticky bottom-0 z-40">
        <div className="max-w-[1400px] mx-auto px-2 flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em]">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full animate-pulse ${user ? 'bg-black' : 'bg-red-500'}`} /> {user ? 'Uplink Established' : 'Offline Mode'}
            </span>
            <span className="opacity-50">v.3.1.0_PROD</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="hover:underline cursor-pointer">Protocol: Brutalist_OS</span>
            <span className="opacity-50 italic">© 2026 FrameX</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
