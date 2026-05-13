import { motion } from 'motion/react';
import { Download, ExternalLink, Globe, Layout, Briefcase, User, Calendar } from 'lucide-react';

interface Profile {
  id: string;
  url: string;
  name: string;
  headline: string;
  company: string;
  about: string;
  experience: string;
  industry: string;
  personalWebsite?: string;
  companyWebsite?: string;
  createdAt: any;
}

interface Props {
  profiles: Profile[];
  onSelect: (profile: Profile) => void;
  onExport: () => void;
}

export default function ProfileTable({ profiles, onSelect, onExport }: Props) {
  if (profiles.length === 0) return null;

  return (
    <div className="space-y-6 overflow-hidden">
      <div className="flex items-center justify-between border-b-4 border-black pb-4">
        <h2 className="text-2xl font-black uppercase tracking-tighter italic">Intelligence Archive</h2>
        <div className="flex items-center gap-4">
          <button 
            onClick={onExport}
            className="flex items-center gap-2 bg-accent text-black px-4 py-2 border-2 border-black font-black text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-all shadow-[4px_4px_0px_0px_#000] active:shadow-none active:translate-x-1 active:translate-y-1"
          >
            <Download className="w-4 h-4" /> Export CSV Sheet
          </button>
          <span className="text-[10px] font-black bg-black text-white px-3 py-2 uppercase tracking-widest border-2 border-black">{profiles.length} Records</span>
        </div>
      </div>

      <div className="overflow-x-auto border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-black text-white text-[10px] uppercase tracking-widest font-black">
              <th className="p-4 border-r border-white/20">Identity</th>
              <th className="p-4 border-r border-white/20">Ecosystem</th>
              <th className="p-4 border-r border-white/20">Digital Presence</th>
              <th className="p-4 border-r border-white/20">Status</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black">
            {profiles.map((profile) => (
              <motion.tr 
                key={profile.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hover:bg-accent/10 transition-colors group cursor-pointer"
                onClick={() => onSelect(profile)}
              >
                <td className="p-4 border-r-2 border-black">
                  <div className="flex items-start gap-3">
                    <div className="bg-black text-accent p-2 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-black text-sm uppercase leading-none mb-1">{profile.name}</div>
                      <div className="text-[10px] text-black/40 font-bold uppercase truncate max-w-[200px]">{profile.headline}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 border-r-2 border-black">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                      <Briefcase className="w-3 h-3 text-black/40" />
                      {profile.company}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-black/40">
                      <Layout className="w-3 h-3" />
                      {profile.industry}
                    </div>
                  </div>
                </td>
                <td className="p-4 border-r-2 border-black">
                  <div className="flex flex-col gap-2">
                    {profile.personalWebsite && (
                      <a 
                        href={profile.personalWebsite} 
                        target="_blank" 
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 text-[10px] font-black uppercase hover:text-accent transition-colors"
                      >
                        <Globe className="w-3 h-3" /> PERS_SITE
                      </a>
                    )}
                    {profile.companyWebsite && (
                      <a 
                        href={profile.companyWebsite} 
                        target="_blank" 
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 text-[10px] font-black uppercase hover:text-accent transition-colors"
                      >
                        <Briefcase className="w-3 h-3" /> COMP_SITE
                      </a>
                    )}
                    {!profile.personalWebsite && !profile.companyWebsite && (
                      <span className="text-[10px] font-black uppercase opacity-20 italic">No Links Found</span>
                    )}
                  </div>
                </td>
                <td className="p-4 border-r-2 border-black">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase">
                    <Calendar className="w-3 h-3 text-black/40" />
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </div>
                </td>
                <td className="p-4">
                  <button className="bg-black text-white p-2 group-hover:bg-accent group-hover:text-black transition-all">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
