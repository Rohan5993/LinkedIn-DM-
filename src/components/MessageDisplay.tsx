import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, Sparkles, Globe, Briefcase, User, Info, Layout } from 'lucide-react';
import type { OutreachContent } from '../services/geminiService';

interface Props {
  content: OutreachContent;
}

export default function MessageDisplay({ content }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-12" id="message-display-container">
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

      {/* CONNECTION REQUEST */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white border-4 border-black p-8 relative group shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
      >
        <div className="flex justify-between items-start mb-6 border-b-2 border-black pb-4">
          <span className="text-[10px] font-black tracking-[0.3em] uppercase">01 / Connection_Req</span>
          <div className="flex items-center gap-4">
            <span className={`text-[10px] font-mono font-black ${content.connectionRequest.length > 280 ? 'text-red-500' : 'text-black/30'}`}>
              {content.connectionRequest.length} / 280
            </span>
            {copiedId === 'req' && <Check className="w-4 h-4 text-green-500" />}
          </div>
        </div>
        <p className="text-4xl font-black leading-[1] tracking-tighter uppercase mb-8 italic">
          "{content.connectionRequest}"
        </p>
        <button 
          onClick={() => copyToClipboard(content.connectionRequest, 'req')}
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
        <p className="text-4xl font-black leading-[1] tracking-tighter uppercase mb-8 italic">
          "{content.firstDM}"
        </p>
        <button 
          onClick={() => copyToClipboard(content.firstDM, 'dm')}
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
        <p className="text-sm font-mono leading-relaxed text-white/80 uppercase">
          {content.icebreakerAngle}
        </p>
      </motion.div>
    </div>
  );
}
