import { createClient } from '@supabase/supabase-js';

// Avoid embedding service role / anon keys directly in source for production.
// Expect key in environment variable at build/runtime.
const SUPABASE_URL = 'https://snlognlmjbyjrkqvqfdz.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || '');
