import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects, runnerTokens, userApiKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ChatView } from "@/components/chat/chat-view";

export default async function ChatPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  // Projeleri getir
  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId));

  // API anahtar durumunu kontrol et (Kurulum Rehberi özeti için)
  const keys = await db
    .select({ provider: userApiKeys.provider })
    .from(userApiKeys)
    .where(eq(userApiKeys.userId, userId));
  const hasGeminiKey = keys.some((k) => k.provider === "gemini");

  // Runner token getir veya oluştur
  let tokens = await db
    .select()
    .from(runnerTokens)
    .where(eq(runnerTokens.userId, userId))
    .limit(1);

  let token = tokens[0]?.token;
  if (!token) {
    const crypto = await import("crypto");
    token = "dev_sec_" + crypto.randomBytes(24).toString("hex");
    await db.insert(runnerTokens).values({
      userId,
      token,
      deviceName: "Primary Computer",
      isOnline: false,
    });
  }

  const runnerRow = tokens[0];
  const isRunnerOnline =
    Boolean(runnerRow?.isOnline) &&
    Boolean(runnerRow?.lastSeenAt) &&
    Date.now() - new Date(runnerRow!.lastSeenAt!).getTime() < 90_000;

  return (
    <ChatView
      initialProjects={userProjects}
      runnerToken={token}
      isRunnerOnline={isRunnerOnline}
      runnerDeviceName={runnerRow?.deviceName || ""}
      hasGeminiKey={hasGeminiKey}
    />
  );
}
