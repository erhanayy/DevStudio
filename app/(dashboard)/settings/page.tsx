import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects, runnerTokens, userApiKeys } from "@/lib/db/schema";
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

  const userProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.userId, userId));

  const runnerRow = tokens[0];
  const isRunnerOnline =
    Boolean(runnerRow?.isOnline) &&
    Boolean(runnerRow?.lastSeenAt) &&
    Date.now() - new Date(runnerRow!.lastSeenAt!).getTime() < 90_000;

  return (
    <SettingsView
      runnerToken={runnerRow?.token || ""}
      isRunnerOnline={isRunnerOnline}
      runnerDeviceName={runnerRow?.deviceName || ""}
      projectCount={userProjects.length}
      hasGeminiKey={keys.some((k) => k.provider === "gemini")}
      hasClaudeKey={keys.some((k) => k.provider === "anthropic")}
      hasOpenaiKey={keys.some((k) => k.provider === "openai")}
    />
  );
}
