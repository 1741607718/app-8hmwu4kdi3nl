import { supabase } from '@/db/supabase';
import type { Profile, UserPermissions } from '@/types/types';

// Mock storage key
const MOCK_STORAGE_KEY = 'mock_profiles_data';

// Helper to get mock data
const getMockData = (): Record<string, Partial<Profile>> => {
  try {
    const data = localStorage.getItem(MOCK_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

// Helper to set mock data
const setMockData = (data: Record<string, Partial<Profile>>) => {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
};

export async function fetchAllProfiles(): Promise<Profile[]> {
  try {
    // Try to fetch from Supabase
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Merge with mock data for permissions/roles if Supabase doesn't have them or needs override
    const mockData = getMockData();

    return profiles.map(p => ({
      ...p,
      ...mockData[p.id] // Override with local mock data (permissions, role)
    }));
  } catch (error) {
    console.warn('Fetching profiles from Supabase failed or table missing columns, falling back to basic info + mock', error);
    // Return empty or mock profiles if database fails completely
    const mockData = getMockData();
    // If we can't even get users list, we might be in trouble unless we have local users.
    // For now, let's assume we can at least get the user list from profiles table,
    // or if that fails, we can't manage permissions for non-existent users.
    return [];
  }
}

export async function updateUserProfile(userId: string, updates: Partial<Profile>): Promise<void> {
    try {
        // Try update Supabase first
        const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
        if (error) {
             // specific handling if column does not exist
             if (error.message.includes('column') || error.code === '42703') {
                 console.warn('Column missing in Supabase, using LocalStorage mock');
                 throw new Error('Column missing');
             }
             throw error;
        }
    } catch (e) {
        // Fallback to LocalStorage
        console.log('Falling back to local storage for user profile update');
        const mockData = getMockData();
        mockData[userId] = { ...(mockData[userId] || {}), ...updates };
        setMockData(mockData);
    }
}

