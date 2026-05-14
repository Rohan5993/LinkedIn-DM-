import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, Sparkles, Globe, Briefcase, User, Info, Layout, ShieldCheck, AlertTriangle, HelpCircle } from 'lucide-react';
import type { OutreachContent } from '../services/geminiService';
import { preferCommaOverLongDash } from '../lib/messageFormat';

interface Props {
  content: OutreachContent;
}

export default function MessageDisplay({ content }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [variationIndex, setVariationIndex] = useState(0);

  const variations = useMemo(() => {
    const v = content.messageVariations;
    if (v && v.length > 0) return v.slice(0, 6);
    return [
      {
        label: 'Relational',
        connectionRequest: content.connectionRequest,
        firstDM: content.firstDM,
        icebreakerAngle: content.icebreakerAngle,
      },
    ];
  }, [content]);

  const active = variations[Math.min(variationIndex, variations.length - 1)] ?? variations[0]!;

  useEffect(() => {
    setVariationIndex(0);
  }, [content.url]);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(preferCommaOverLongDash(text));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const provenance = content.dataSource;

  return (
    <div className="space-y-12" id="message-display-container">
      {/* DATA PROVENANCE */}
      {provenance === 'apify_scrape' ? (
        <div className="border-4 border-black bg-accent px-4 py-3 flex flex-wrap items-center gap-3 shadow-[4px_4px_0px_0px_#000]">
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest">Verified scrape</div>
            <p className="text-[10px] font-bold uppercase opacity-70 mt-0.5">
              Profile fields grounded in live LinkedIn data via Apify (then formatted by Gemini).
            </p>
          </div>
        </div>
      ) : provenance === 'gemini_recon' ? (
        <div className="border-4 border-black bg-amber-200 px-4 py-3 flex flex-wrap items-center gap-3 shadow-[4px_4px_0px_0px_#000]">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-900" />
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-950">Unverified, search-based recon</div>
            <p className="text-[10px] font-bold uppercase opacity-80 mt-0.5 text-amber-950">
              Apify scrape unavailable; name, role, and company may come from Google Search and URL context only. Double-check before sending.
            </p>
          </div>
        </div>
      ) : (
        <div className="border-4 border-dashed border-black/40 bg-white px-4 py-3 flex flex-wrap items-center gap-3">
          <HelpCircle className="w-5 h-5 shrink-0 opacity-50" />
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Provenance not recorded</div>
            <p className="text-[10px] font-bold uppercase opacity-40 mt-0.5">
              This archive row predates source tagging. Re-run synthesis on the profile URL for a verified badge.
            </p>
          </div>
        </div>
      )}

      {/* EXTRACTED INTELLIGENCE GRID */}
      <section className="space-y-6">
        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em]">
          <Info className="w-4 h-4 text-accent" />
          Extracted_Intelligence_Log
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-4 border-black p-6 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="text-[10px] font-black uppercase text-black/30 mb-4 flex items-center gap-2">
              <User className="w-3 h-3" /> Identity_Metrics
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-black uppercase opacity-20">Full Name</div>
                <div className="font-black text-lg uppercase italic">{content.name || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-[10px] font-black uppercase opacity-20">Headline</div>
                <div className="font-bold text-xs uppercase opacity-70 leading-tight">{content.headline || 'No Headline'}</div>
              </div>
            </div>
          </div>

          <div className="border-4 border-black p-6 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="text-[10px] font-black uppercase text-black/30 mb-4 flex items-center gap-2">
              <Briefcase className="w-3 h-3" /> Structural_Data
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-black uppercase opacity-20">Current Company</div>
                <div className="font-black text-lg uppercase italic">{content.company || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-[10px] font-black uppercase opacity-20">Industry Sector</div>
                <div className="font-bold text-xs uppercase opacity-70">{content.industry || 'Unknown'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-4 border-black p-6 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-[10px] font-black uppercase text-black/30 mb-4 flex items-center gap-2">
            <Layout className="w-3 h-3" /> Experience_&_Summary
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase opacity-20 italic">About_Segment</div>
              <p className="text-xs font-bold leading-relaxed opacity-80">{content.about || 'No Summary Available'}</p>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase opacity-20 italic">Career_Trajectory</div>
              <p className="text-xs font-bold leading-relaxed opacity-80">{content.experience || 'No Experience Data Obtained'}</p>
            </div>
          </div>
        </div>

        {/* GROUNDING SOURCES */}
        {content.sources && content.sources.length > 0 && (
          <div className="border-4 border-black p-6 bg-black text-white shadow-[8px_8px_0px_0px_rgba(212,255,63,1)]">
            <div className="text-[10px] font-black uppercase text-accent mb-4 flex items-center gap-2">
              <Globe className="w-3 h-3" /> Data_Reconnaissance_Nodes
            </div>
            <div className="flex flex-wrap gap-3">
              {content.sources.map((source, index) => (
                <a 
                  key={index}
                  href={source.uri}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white/10 border border-white/20 px-3 py-2 text-[8px] font-black uppercase hover:bg-accent hover:text-black transition-all flex items-center gap-2 truncate max-w-xs"
                >
                  <div className="w-1.5 h-1.5 bg-accent rounded-full shrink-0" />
                  {source.title}
                </a>
              ))}
            </div>
          </div>
        )}

        {(content.personalWebsite || content.companyWebsite) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {content.personalWebsite && (
              <a 
                href={content.personalWebsite} 
                target="_blank" 
                rel="noreferrer"
                className="border-4 border-black p-4 bg-accent text-black font-black uppercase text-[10px] flex items-center justify-between hover:translate-x-2 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4" /> Personal Website Found
                </div>
                <Copy className="w-3 h-3" />
              </a>
            )}
            {content.companyWebsite && (
              <a 
                href={content.companyWebsite} 
                target="_blank" 
                rel="noreferrer"
                className="border-4 border-black p-4 bg-black text-white font-black uppercase text-[10px] flex items-center justify-between hover:translate-x-2 transition-transform shadow-[4px_4px_0px_0px_rgba(212,255,63,0.3)]"
              >
                <div className="flex items-center gap-3">
                  <Briefcase className="w-4 h-4" /> Company Website Found
                </div>
                <Copy className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </section>

      {/* MESSAGE VARIATIONS */}
      {variations.length > 1 && (
        <div className="space-y-3">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-black/50">
            Outreach variants ({variations.length}), pick one to copy
          </div>
          <div className="flex flex-wrap gap-2">
            {variations.map((v, i) => (
              <button
                key={`${v.label}-${i}`}
                type="button"
                onClick={() => setVariationIndex(i)}
                className={`border-4 border-black px-3 py-2 text-[10px] font-black uppercase tracking-tight transition-all shadow-[3px_3px_0px_0px_#000] ${
                  variationIndex === i ? 'bg-accent text-black' : 'bg-white hover:bg-black/5'
                }`}
              >
                {i + 1}. {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CONNECTION REQUEST */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white border-4 border-black p-8 relative group shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
      >
        <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
          <span className="text-[10px] font-black tracking-[0.3em] uppercase">01 / Connection_Req</span>
          <div className="flex items-center gap-4">
            <span className={`text-[10px] font-mono font-black ${active.connectionRequest.length > 280 ? 'text-red-500' : 'text-black/30'}`}>
              {active.connectionRequest.length} / 280
            </span>
            {copiedId === 'req' && <Check className="w-4 h-4 text-green-500" />}
          </div>
        </div>
        <p className="text-xl sm:text-2xl md:text-3xl font-normal leading-[1.1em] [text-transform:math-auto] mb-6 text-black normal-case not-italic tracking-normal">
          {preferCommaOverLongDash(active.connectionRequest)}
        </p>
        <button 
          onClick={() => copyToClipboard(active.connectionRequest, 'req')}
          className="bg-black text-white px-8 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:text-black transition-all active:translate-y-1 active:shadow-none"
        >
          Copy Connection Msg
        </button>
      </motion.div>

      {/* FIRST DM */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white border-4 border-black p-8 relative group shadow-[12px_12px_0px_0px_rgba(212,255,63,1)]"
      >
        <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
          <span className="text-[10px] font-black tracking-[0.3em] uppercase">02 / First_DM</span>
          <div className="flex items-center gap-4">
             <span className="text-[10px] font-mono font-black text-black/30">CONVERSATIONAL_ALPHA</span>
            {copiedId === 'dm' && <Check className="w-4 h-4 text-green-500" />}
          </div>
        </div>
        <p className="text-xl sm:text-2xl md:text-3xl font-normal leading-[1.1em] [text-transform:math-auto] mb-6 text-black normal-case not-italic tracking-normal">
          {preferCommaOverLongDash(active.firstDM)}
        </p>
        <button 
          onClick={() => copyToClipboard(active.firstDM, 'dm')}
          className="bg-black text-white px-8 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:text-black transition-all active:translate-y-1 active:shadow-none"
        >
          Copy First DM
        </button>
      </motion.div>

      {/* ICEBREAKER ANGLE */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-black text-white border-4 border-black p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)]"
      >
        <div className="flex items-center gap-4 mb-6 border-b border-white/20 pb-4">
          <Sparkles className="w-5 h-5 text-accent" />
          <span className="text-[10px] font-black tracking-[0.3em] uppercase">03 / Strategy_Log</span>
        </div>
        <p className="text-sm font-normal leading-[1.1em] [text-transform:math-auto] text-white/90 normal-case not-italic">
          {preferCommaOverLongDash(active.icebreakerAngle)}
        </p>
      </motion.div>
    </div>
  );
}
