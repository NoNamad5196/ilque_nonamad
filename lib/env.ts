const readEnv = (key: string) => process.env[key]?.trim() ?? "";

export const env = {
  googleClientId: readEnv("GOOGLE_CLIENT_ID"),
  googleClientSecret: readEnv("GOOGLE_CLIENT_SECRET"),
  nextAuthSecret: readEnv("NEXTAUTH_SECRET"),
  nextAuthUrl: readEnv("NEXTAUTH_URL"),
  googleAiApiKey: readEnv("GOOGLE_AI_API_KEY"),
  nextPublicSupabaseUrl: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
  nextPublicSupabaseAnonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY")
};

export const has = {
  auth:
    Boolean(env.googleClientId) &&
    Boolean(env.googleClientSecret) &&
    Boolean(env.nextAuthSecret),
  supabase:
    Boolean(env.nextPublicSupabaseUrl) &&
    Boolean(env.nextPublicSupabaseAnonKey),
  serviceSupabase:
    Boolean(env.nextPublicSupabaseUrl) &&
    Boolean(env.supabaseServiceRoleKey),
  ai: Boolean(env.googleAiApiKey)
};
