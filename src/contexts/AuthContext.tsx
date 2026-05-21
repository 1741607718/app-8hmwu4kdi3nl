import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Profile } from '@/types/types';
import { casLogout } from '@/services/casAuth';

type AuthUser = {
  id: string;
  email: string;
  user_metadata: {
    name?: string | null;
    username?: string | null;
    department?: string | null;
  };
};

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (_username: string, _password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUserPermissions: (userId: string, permissions: NonNullable<Profile['permissions']>) => Promise<void>;
}

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || '';
const isLocalApi = AUTH_API_URL.includes('localhost') || AUTH_API_URL.includes('127.0.0.1');
const apiBaseUrl = isLocalApi ? '' : AUTH_API_URL;

function buildAuthUrl(path: string) {
  if (!apiBaseUrl || path.startsWith('/api/')) {
    return path;
  }
  return `${apiBaseUrl}${path}`;
}

async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildAuthUrl(path), {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    throw new Error('未登录');
  }

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || '请求失败');
  }

  return result as T;
}

const createAuthUser = (data: Profile): AuthUser => ({
  id: data.id,
  email: data.email || `${data.username || data.id}@local.auth`,
  user_metadata: {
    name: data.name,
    username: data.username,
    department: data.department,
  },
});

const clearStoredAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
};

const getDefaultPermissions = (role: Profile['role']): NonNullable<Profile['permissions']> => ({
  vehicle: role === 'admin' ? 3 : 0,
  personnel: role === 'admin' ? 3 : 0,
  dormitory: role === 'admin' ? 3 : 0,
  fireSafety: role === 'admin' ? 3 : 0,
  security: role === 'admin' ? 3 : 0,
});

async function fetchCurrentProfile(): Promise<Profile | null> {
  try {
    const response = await authRequest<{ success: boolean; data: Profile }>('/api/auth/me');
    const profileData = response.data;

    if (!profileData.role) {
      profileData.role = 'user';
    }

    profileData.permissions = {
      ...getDefaultPermissions(profileData.role),
      ...(profileData.permissions || {}),
    };

    return profileData;
  } catch (error) {
    console.error('获取用户资料错误:', error);
    return null;
  }
}

async function getSessionUser(): Promise<AuthUser | null> {
  const token = localStorage.getItem('token');
  if (!token) {
    return null;
  }

  const profile = await fetchCurrentProfile();
  if (!profile) {
    clearStoredAuth();
    return null;
  }

  return createAuthUser(profile);
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    const nextProfile = await fetchCurrentProfile();
    if (!nextProfile) {
      clearStoredAuth();
      setUser(null);
      setProfile(null);
      return;
    }

    setProfile(nextProfile);
    setUser(createAuthUser(nextProfile));
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const sessionUser = await getSessionUser();
        if (!mounted) {
          return;
        }

        if (!sessionUser) {
          setUser(null);
          setProfile(null);
          return;
        }

        setUser(sessionUser);
        const nextProfile = await fetchCurrentProfile();
        if (mounted) {
          setProfile(nextProfile);
        }
      } catch (error) {
        console.error('AuthContext 初始化失败:', error);
        if (mounted) {
          clearStoredAuth();
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void initializeAuth();

    const handleStorageChange = async (event: StorageEvent) => {
      if (event.key !== 'token') {
        return;
      }

      const nextUser = await getSessionUser();
      if (!mounted) {
        return;
      }

      if (nextUser) {
        setUser(nextUser);
        const nextProfile = await fetchCurrentProfile();
        if (mounted) {
          setProfile(nextProfile);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      mounted = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      const normalizedUsername = username.includes('@') ? username.split('@')[0] : username;
      const response = await authRequest<{ success: boolean; data: { token: string; user: Profile } }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: normalizedUsername, password }),
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('userId', response.data.user.id);

      const nextProfile = await fetchCurrentProfile();
      if (nextProfile) {
        setProfile(nextProfile);
        setUser(createAuthUser(nextProfile));
      }

      return { error: null };
    } catch (error) {
      console.error('登录失败:', error);
      return { error: error as Error };
    }
  };

  const signUp = async () => {
    return { error: new Error('当前环境不支持前端自助注册，请使用统一认证或联系管理员') };
  };

  const signOut = async () => {
    try {
      sessionStorage.setItem('logging_out', 'true');
      await authRequest('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('登出过程发生意外错误:', error);
    } finally {
      clearStoredAuth();
      setUser(null);
      setProfile(null);
      setLoading(false);

      setTimeout(() => {
        try {
          casLogout();
        } catch (error) {
          console.error('CAS 登出跳转失败:', error);
          window.location.href = '/login';
        } finally {
          sessionStorage.removeItem('logging_out');
        }
      }, 100);
    }
  };

  const updateUserPermissions = async (userId: string, permissions: NonNullable<Profile['permissions']>) => {
    const permissionEntries = Object.entries(permissions).map(([module, level]) => ({ module, level }));
    await authRequest(`/api/auth/users/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions: permissionEntries }),
    });

    if (profile?.id === userId) {
      await refreshProfile();
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile, updateUserPermissions }}>
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
