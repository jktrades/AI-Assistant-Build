import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-side client using the service role key. Bypasses RLS — never import
// this into a client component. All API routes use this.
let _admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Copy .env.example to .env.local and fill them in."
    );
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

// Stale-read buster (Part 8, bug #5). Append a unique limit per request so
// PostgREST's edge cache never serves two requests the same cache key.
export function cacheBustLimit(): number {
  return 100000 + (Date.now() % 100000);
}
