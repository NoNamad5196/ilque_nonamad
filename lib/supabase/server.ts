import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env, has } from "@/lib/env";

let serviceClient: SupabaseClient | null = null;

export function createServiceSupabaseClient() {
  if (!has.serviceSupabase) {
    return null;
  }

  if (!serviceClient) {
    serviceClient = createClient(env.nextPublicSupabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return serviceClient;
}
