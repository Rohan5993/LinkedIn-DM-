import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function signIn() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  } catch (err) {
    console.error("Supabase auth error:", err);
    alert("Authentication module restricted in current environment. Using local session.");
  }
}

export async function sign_out() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error("Sign out error:", err);
  }
}

const LOCAL_STORAGE_KEY = 'linkforge_profiles';

export async function saveProfile(profileData: any) {
  const { data: { user } } = await supabase.auth.getUser();
  
  // Always save to local storage as fallback/addition
  const localProfiles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  const newProfile = {
    id: crypto.randomUUID(),
    ...profileData,
    createdAt: new Date().toISOString()
  };
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([newProfile, ...localProfiles]));

  if (user) {
    try {
      await supabase
        .from('profiles')
        .insert([
          {
            user_id: user.id,
            url: profileData.url,
            name: profileData.name,
            headline: profileData.headline,
            company: profileData.company,
            about: profileData.about,
            experience: profileData.experience,
            industry: profileData.industry,
            personal_website: profileData.personalWebsite,
            company_website: profileData.companyWebsite,
            connection_request: profileData.connectionRequest,
            first_dm: profileData.firstDM,
            icebreaker_angle: profileData.icebreakerAngle,
          }
        ]);
    } catch (err) {
      console.warn("Could not sync to Supabase:", err);
    }
  }
  
  return [newProfile];
}

export async function getProfiles() {
  let cloudProfiles: any[] = [];
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        cloudProfiles = data.map(p => ({
          id: p.id,
          url: p.url,
          name: p.name,
          headline: p.headline,
          company: p.company,
          about: p.about,
          experience: p.experience,
          industry: p.industry,
          personalWebsite: p.personal_website,
          companyWebsite: p.company_website,
          connectionRequest: p.connection_request,
          firstDM: p.first_dm,
          icebreakerAngle: p.icebreaker_angle,
          createdAt: p.created_at
        }));
      }
    } catch (err) {
      console.warn("Supabase fetch failed, using local only:", err);
    }
  }

  const localProfiles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  
  // Merge and prioritize cloud if logged in, otherwise just local
  // For simplicity, we'll just return merged or local
  const combined = [...localProfiles, ...cloudProfiles];
  // Remove duplicates by ID if needed, but for now simple merge
  return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
