import { auth } from "@/auth";
import { db } from "@/lib/db";
import { runnerTokens, userApiKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SettingsView } from "./settings-view";

export default async function SettingsPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const tokens = await db
    .select()
    .from(runnerTokens)
    .where(eq(runnerTokens.userId, userId))
    .limit(1);

  const keys = await db
    .select({ provider: userApiKeys.provider })
    .from(userApiKeys)
    .where(eq(userApiKeys.userId, userId));

  return (
    <SettingsView
      runnerToken={tokens[0]?.token || ""}
      hasGeminiKey={keys.some((k) => k.provider === "gemini")}
      hasClaudeKey={keys.some((k) => k.provider === "anthropic")}
      hasOpenaiKey={keys.some((k) => k.provider === "openai")}
    />
  );
}
