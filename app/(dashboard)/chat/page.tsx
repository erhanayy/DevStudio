import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects, runnerTokens } from "@/lib/db/schema";
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

  return (
    <ChatView
      initialProjects={userProjects}
      runnerToken={token}
      isRunnerOnline={tokens[0]?.isOnline || false}
    />
  );
}
