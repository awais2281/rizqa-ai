import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

/**
 * Get user-specific storage key
 * If user is logged in, returns key with user ID prefix
 * If user is not logged in, returns key without prefix (for backwards compatibility)
 */
export const getUserStorageKey = async (baseKey: string): Promise<string> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return `user_${session.user.id}_${baseKey}`;
    }
    return baseKey;
  } catch (error) {
    console.error('Error getting user storage key:', error);
    return baseKey;
  }
};

/**
 * Get current user ID synchronously (for use in components)
 */
export const getCurrentUserId = (): string | null => {
  try {
    // This is a synchronous check - we'll need to pass user ID from props/context
    // For now, return null and we'll get it from session in each component
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * Get user-specific storage key with user ID
 */
export const getUserStorageKeyWithId = (userId: string | null, baseKey: string): string => {
  if (userId) {
    return `user_${userId}_${baseKey}`;
  }
  return baseKey;
};

