const readEnv = (key: string) => process.env[key]?.trim() ?? "";

export const env = {
  googleClientId: readEnv("GOOGLE_CLIENT_ID"),
  googleClientSecret: readEnv("GOOGLE_CLIENT_SECRET"),
  nextAuthSecret: readEnv("NEXTAUTH_SECRET"),
  nextAuthUrl: readEnv("NEXTAUTH_URL"),
  googleAiApiKey: readEnv("GOOGLE_AI_API_KEY"),
  googleAiModel: readEnv("GOOGLE_AI_MODEL") || "gemini-2.5-flash-lite",
  nextPublicSupabaseUrl: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
  nextPublicSupabaseAnonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
  notionToken: readEnv("NOTION_TOKEN"),
  notionDatabaseId: readEnv("NOTION_DATABASE_ID")
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
  ai: Boolean(env.googleAiApiKey),
  notion: Boolean(env.notionToken) && Boolean(env.notionDatabaseId)
};
