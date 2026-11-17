"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { userApiKeys, runnerTokens } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { encryptSecret } from "@/lib/crypto/vault";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export async function saveApiKeysAction(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Yetkisiz erişim");

  const geminiKey = formData.get("geminiKey") as string;
  const claudeKey = formData.get("claudeKey") as string;
  const openaiKey = formData.get("openaiKey") as string;

  const saveKey = async (provider: string, keyVal: string) => {
    if (!keyVal || keyVal.trim() === "") return;
    const { encryptedKey, iv, authTag } = encryptSecret(keyVal.trim());

    const existing = await db
      .select()
      .from(userApiKeys)
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, provider)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userApiKeys)
        .set({ encryptedKey, iv, authTag, updatedAt: new Date() })
        .where(eq(userApiKeys.id, existing[0].id));
    } else {
      await db.insert(userApiKeys).values({
        userId,
        provider,
        encryptedKey,
        iv,
        authTag,
      });
    }
  };

  await saveKey("gemini", geminiKey);
  await saveKey("anthropic", claudeKey);
  await saveKey("openai", openaiKey);

  revalidatePath("/settings");
  return { success: true };
}

export async function regenerateRunnerTokenAction() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Yetkisiz erişim");

  const newToken = "dev_sec_" + crypto.randomBytes(24).toString("hex");

  const existing = await db
    .select()
    .from(runnerTokens)
    .where(eq(runnerTokens.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(runnerTokens)
      .set({ token: newToken, isOnline: false, lastSeenAt: null })
      .where(eq(runnerTokens.id, existing[0].id));
  } else {
    await db.insert(runnerTokens).values({
      userId,
      token: newToken,
      deviceName: "Primary Computer",
      isOnline: false,
    });
  }

  revalidatePath("/settings");
  revalidatePath("/chat");
  return { success: true, token: newToken };
}
