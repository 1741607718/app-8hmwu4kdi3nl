import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/types';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
  
  // 如果profiles表中没有name，尝试从user metadata获取
  if (data && !data.name) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (!userError && userData?.user) {
      const userMetadata = userData.user.user_metadata;
      if (userMetadata?.name) {
        // 更新profiles表中的name字段
        await supabase
          .from('profiles')
          .update({ name: userMetadata.name })
          .eq('id', userId);
        
        // 返回更新后的数据
        return { ...data, name: userMetadata.name };
      }
    }
  }
  

  return data;
}
interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const profileData = await getProfile(user.id);
    setProfile(profileData);
    
    // 如果用户是通过CAS登录的，尝试同步CAS用户信息到profiles表
    const userMetadata = user.user_metadata;
    if (userMetadata && (userMetadata.cas_id || userMetadata.name)) {
      await syncCASUserInfo(user.id, userMetadata);
    }
  };

  const syncCASUserInfo = async (userId: string, userMetadata: any) => {
    if (!userMetadata.name && !userMetadata.username) return;
    
    // 检查profiles表中是否已有该用户信息
    const { data: existingProfile, error } = await supabase
      .from('profiles')
      .select('name, username')
      .eq('id', userId)
      .single();
      
    if (!error && existingProfile) {
      // 如果profiles中的信息为空或不完整，更新它
      const updates: any = {};
      if (!existingProfile.name && userMetadata.name) {
        updates.name = userMetadata.name;
      }
      if (!existingProfile.username && userMetadata.username) {
        updates.username = userMetadata.username;
      }
      
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('profiles')
          .update(updates)
          .eq('id', userId);
          
        // 更新本地状态
        setProfile(prev => prev ? { ...prev, ...updates } : null);
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        getProfile(session.user.id).then(setProfile);
      }
      setLoading(false);
    });
    // In this function, do NOT use any await calls. Use `.then()` instead to avoid deadlocks.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        getProfile(session.user.id).then(setProfile);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithUsername = async (username: string, password: string) => {
    try {
      const email = `${username}@miaoda.com`;
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUpWithUsername = async (username: string, password: string) => {
    try {
      const email = `${username}@miaoda.com`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn: signInWithUsername, signUp: signUpWithUsername, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}