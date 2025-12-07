import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://zvfcfflyujullqyqmhxw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2ZmNmZmx5dWp1bGxxeXFtaHh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5MDgzODksImV4cCI6MjA4MDQ4NDM4OX0.eQZu4KUJ_-yl8nYOhb9brZuTkptu9czb8imdnVLi09E';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

