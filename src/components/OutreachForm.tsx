import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { Link as LinkIcon, Zap, LogIn } from 'lucide-react';
import { signIn, supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface Props {
  onGenerate: (urls: string[]) => void;
  isLoading: boolean;
}

export default function OutreachForm({ onGenerate, isLoading }: Props) {
  const [urls, setUrls] = useState('');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const urlList = urls
      .split(/[\n,]/)
      .map(u => u.trim())
      .filter(u => u.startsWith('http'));
    
    if (urlList.length > 0) {
      onGenerate(urlList);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setUrls(e.target.value);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8" id="outreach-form-container">
      <div className="space-y-4">
        <label className="text-[10px] font-black uppercase tracking-widest block text-black/40">LinkedIn Profile URLs (One per line or comma-separated)</label>
        <div className="relative group">
          <div className="absolute top-6 left-4 pointer-events-none">
            <LinkIcon className="w-5 h-5 text-black/20 group-focus-within:text-accent transition-colors" />
          </div>
          <textarea
            required
            name="urls"
            value={urls}
            onChange={handleChange}
            placeholder="https://linkedin.com/in/user1&#10;https://linkedin.com/in/user2"
            rows={4}
            className="w-full bg-[#F5F5F5] border-4 border-black pl-12 pr-4 py-6 focus:outline-none focus:bg-accent/5 focus:border-accent transition-all font-black text-lg placeholder:opacity-10 shadow-[8px_8px_0px_0px_#000] resize-none"
            id="input-urls"
          />
        </div>
      </div>

      <button
        disabled={isLoading || !urls.trim()}
        type="submit"
        className="w-full bg-black text-white py-6 text-xs font-black uppercase tracking-[0.4em] hover:bg-accent hover:text-black transition-all disabled:opacity-50 flex items-center justify-center gap-4 group border-4 border-black active:shadow-none active:translate-x-1 active:translate-y-1 shadow-[8px_8px_0px_0px_rgba(212,255,63,1)]"
        id="btn-generate"
      >
        {isLoading ? (
          <span className="animate-pulse italic">EXTRACTING_MULTIPLE_PROFILES...</span>
        ) : (
          <>
            INITIATE_BULK_EXTRACTION 
            <Zap className="w-4 h-4 group-hover:scale-125 transition-transform" />
          </>
        )}
      </button>
      
      {!user && (
        <p className="text-[10px] font-mono text-center uppercase opacity-50 tracking-widest">
          * RUNNING_IN_LOCAL_MODE: DATA PERSISTED TO CLIENT SIDE STORAGE
        </p>
      )}
    </form>
  );
}
