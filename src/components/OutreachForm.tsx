import { useState, useEffect, FormEvent, ChangeEvent, useMemo, useRef } from 'react';
import { Link as LinkIcon, Zap, Upload, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { extractLinkedinProfileUrls, mergeUniqueProfileUrls } from '../lib/linkedinUrls';
import { extractUrlsFromSpreadsheetFile } from '../lib/parseSheetUrls';

interface Props {
  onGenerate: (urls: string[]) => void;
  isLoading: boolean;
}

export default function OutreachForm({ onGenerate, isLoading }: Props) {
  const [urls, setUrls] = useState('');
  const [sheetUrls, setSheetUrls] = useState<string[]>([]);
  const [sheetLabel, setSheetLabel] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const urlsFromText = useMemo(() => extractLinkedinProfileUrls(urls), [urls]);
  const totalTargets = useMemo(
    () => mergeUniqueProfileUrls(urlsFromText, sheetUrls).length,
    [urlsFromText, sheetUrls]
  );

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
    const urlList = mergeUniqueProfileUrls(urlsFromText, sheetUrls);
    if (urlList.length > 0) {
      onGenerate(urlList);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setUrls(e.target.value);
  };

  const handleSheetPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setSheetError(null);
    if (!file) return;
    try {
      const found = await extractUrlsFromSpreadsheetFile(file);
      if (found.length === 0) {
        setSheetUrls([]);
        setSheetLabel(null);
        setSheetError('No LinkedIn /in/ URLs found in that file. Use CSV, TSV, TXT, or XLSX with profile links in any column.');
        return;
      }
      setSheetUrls(found);
      setSheetLabel(file.name);
    } catch (err) {
      setSheetUrls([]);
      setSheetLabel(null);
      setSheetError(err instanceof Error ? err.message : 'Could not read that file.');
    }
  };

  const clearSheet = () => {
    setSheetUrls([]);
    setSheetLabel(null);
    setSheetError(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8" id="outreach-form-container">
      <div className="space-y-4">
        <label className="text-[10px] font-black uppercase tracking-widest block text-black/40">LinkedIn Profile URLs (paste, one per line, or comma-separated — http(s) or linkedin.com/in/…)</label>
        <div className="relative group">
          <div className="absolute top-6 left-4 pointer-events-none">
            <LinkIcon className="w-5 h-5 text-black/20 group-focus-within:text-accent transition-colors" />
          </div>
          <textarea
            name="urls"
            value={urls}
            onChange={handleChange}
            placeholder="https://linkedin.com/in/user1&#10;linkedin.com/in/user2"
            rows={4}
            className="w-full bg-[#F5F5F5] border-4 border-black pl-12 pr-4 py-6 focus:outline-none focus:bg-accent/5 focus:border-accent transition-all font-black text-lg placeholder:opacity-10 shadow-[8px_8px_0px_0px_#000] resize-none"
            id="input-urls"
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls"
          className="hidden"
          onChange={handleSheetPick}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 border-4 border-black bg-white px-4 py-3 text-[10px] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#000] hover:bg-accent transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Upload sheet (CSV / TSV / TXT / XLSX)
          </button>
          {sheetLabel && sheetUrls.length > 0 && (
            <span className="inline-flex items-center gap-2 border-2 border-black bg-accent/30 px-3 py-2 text-[10px] font-black uppercase tracking-tight">
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              {sheetLabel} — {sheetUrls.length} URL{sheetUrls.length === 1 ? '' : 's'}
              <button type="button" onClick={clearSheet} className="underline ml-1 font-mono text-[9px]">
                Clear
              </button>
            </span>
          )}
        </div>
        {sheetError && (
          <p className="text-[10px] font-bold uppercase text-red-700 border-l-4 border-red-600 pl-3">{sheetError}</p>
        )}
        {totalTargets > 0 && (
          <p className="text-[10px] font-mono uppercase text-black/50">
            Ready to extract: {totalTargets} unique profile{totalTargets === 1 ? '' : 's'}
            {urlsFromText.length > 0 && sheetUrls.length > 0 ? ' (textarea + sheet merged)' : ''}
          </p>
        )}
      </div>

      <button
        disabled={isLoading || totalTargets === 0}
        type="submit"
        className="w-full bg-black text-white py-6 text-xs font-black uppercase tracking-[0.4em] hover:bg-accent hover:text-black transition-all disabled:opacity-50 flex items-center justify-center gap-4 group border-4 border-black active:shadow-none active:translate-x-1 active:translate-y-1 shadow-[8px_8px_0px_0px_rgba(212,255,63,1)]"
        id="btn-generate"
      >
        {isLoading ? (
          <span className="animate-pulse italic">GENERATING</span>
        ) : (
          <>
            Generate
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
