import { Client } from "@notionhq/client";

import { env, has } from "@/lib/env";

let notionClient: Client | null = null;

export function getNotionClient() {
  if (!has.notion) {
    return null;
  }

  notionClient ??= new Client({
    auth: env.notionToken,
    timeoutMs: 15000,
    notionVersion: "2025-09-03"
  });

  return notionClient;
}

export function getNotionDatabaseId() {
  return env.notionDatabaseId.replace(/-/g, "");
}
