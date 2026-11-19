"use server";
import { extractGeminiText } from "@/lib/ai/gemini-parser";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { chatSessions, chatMessages, approvals, projects, userApiKeys } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { decryptSecret } from "@/lib/crypto/vault";

export async function getOrCreateChatSession(userId: string, projectId: string) {
  const existing = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.userId, userId), eq(chatSessions.projectId, projectId)))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const created = await db
    .insert(chatSessions)
    .values({
      userId,
      projectId,
      title: "Geliştirme Sohbeti",
    })
    .returning();

  return created[0];
}

export async function sendMessageAction({
  projectId,
  model,
  content,
}: {
  projectId: string;
  model: string;
  content: string;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Yetkisiz erişim");

  const chatSession = await getOrCreateChatSession(userId, projectId);

  // 1. Kullanıcı mesajını kaydet
  const userMsg = await db
    .insert(chatMessages)
    .values({
      sessionId: chatSession.id,
      role: "user",
      content,
    })
    .returning();

  // 2. Proje detaylarını getir
  const projectList = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const currentProject = projectList[0];
  const projectName = currentProject?.name || "Proje";
  const projectPath = currentProject?.localPath || "";
  const deployCmd = currentProject?.deployCommand || "";

  // 3. Kullanıcının API anahtarını kontrol et
  const keyRecords = await db
    .select()
    .from(userApiKeys)
    .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.provider, "gemini")))
    .limit(1);

  let apiKey = process.env.GEMINI_API_KEY || "";
  if (keyRecords.length > 0) {
    try {
      apiKey = decryptSecret(
        keyRecords[0].encryptedKey,
        keyRecords[0].iv,
        keyRecords[0].authTag
      );
    } catch (e) {
      console.error("Anahtar çözme hatası:", e);
    }
  }

  // Geçmiş son mesajları getir (Çok turlu konuşma hafızası)
  const pastMessages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, chatSession.id))
    .orderBy(desc(chatMessages.createdAt))
    .limit(8);

  const historyText = pastMessages
    .reverse()
    .filter((m) => m.id !== userMsg[0].id)
    .map((m) => `${m.role === "user" ? "Kullanıcı" : "DevStudio"}: ${m.content}`)
    .join("\n\n");

  let assistantReply = "";
  let proposedCommand: string | null = null;
  let commandDesc: string | null = null;
  let riskLevel: "low" | "medium" | "high" | "critical" = "medium";

  // 4. Gemini API çağrısı (Varsa dene)
  if (apiKey) {
    const selectedOrPreferred = model || "gemini-3-flash-preview";
    const candidateModels = [
      selectedOrPreferred,
      "gemini-3-flash-preview", // Google AI Studio'da 5s sürede 200 OK veren sağlam model
      "gemini-flash-lite-latest", // 1.5s sürede 200 OK dönen ultra hızlı kurtarma modeli
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite",
    ].filter((val, idx, arr) => arr.indexOf(val) === idx);

    const systemInstruction = `Sen DevStudio adında, kullanıcının mobil telefonundan veya bilgisayarından doğrudan pair-programming yaptığı samimi, zeki ve kıdemli bir Baş Yapay Zeka Mühendisisin (Staff AI Engineer).
Kullanıcı seninle Türkçe konuşuyor. Tıpkı Antigravity veya Claude ile yaptığı gibi tamamen serbest, doğal ve gündelik bir dille sohbet eder; mimari tartışır, soru sorar, fikir danışır veya geliştirme talep eder.
ASLA mekanik, kalıplaşmış veya robotik yanıt verme. Samimi, vizyoner, teknik olarak yetkin ve çözüm odaklı bir mesai arkadaşı gibi ol.

Şu an aktif olan proje: "${projectName}"
Projenin kullanıcının bilgisayarındaki (Mac) yerel dizini: "${projectPath}"
Varsayılan dağıtım komutu: "${deployCmd}"

Eğer kullanıcının talebini yerine getirmek için bilgisayarında bir terminal komutu (git, npm, build, test, deploy, dosya inceleme vb.) çalıştırmak gerekiyorsa:
1. Komutu mutlaka tek bir \`\`\`bash ... \`\`\` kod bloğu içerisine yaz.
2. Neden bu komutu önerdiğini kısaca açıkla.
Eğer sadece soru soruyorsa, dertleşiyorsa veya fikir danışıyorsa komut üretmene gerek yoktur; doğrudan samimi ve aydınlatıcı cevabını ver.`;

    const fullPrompt = historyText
      ? `${systemInstruction}\n\n--- ÖNCEKİ SOHBET GEÇMİŞİ ---\n${historyText}\n\nKullanıcı: ${content}`
      : `${systemInstruction}\n\nKullanıcı: ${content}`;

    for (const m of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000); // 12 sn bekleme

        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: fullPrompt }],
              },
            ],
            generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
          }),
        });

        clearTimeout(timeout);

        if (resp.ok) {
          const json = await resp.json();
          const fullText = extractGeminiText(json);
          if (fullText) {
            assistantReply = fullText;

            const match = assistantReply.match(/\`\`\`(?:bash|sh|shell)?\s*([\s\S]*?)\`\`\`/);
            if (match && match[1]) {
              proposedCommand = match[1].trim();
              commandDesc = `${projectName} üzerinde komut icra edilecek`;
              riskLevel =
                proposedCommand.includes("deploy") ||
                proposedCommand.includes("push") ||
                proposedCommand.includes("rm")
                  ? "critical"
                  : proposedCommand.includes("build") || proposedCommand.includes("install")
                  ? "high"
                  : "low";
            }
            break; // Başarılı, döngüden çık
          }
        } else {
          console.warn(`[Gemini Action] ${m} başarısız (HTTP ${resp.status}), sonraki modele geçiliyor...`);
        }
      } catch (err: any) {
        console.warn(`[Gemini Action] ${m} zaman aşımı / hata:`, err?.message);
      }
    }
  }

  // 5. Eğer hala yanıt yoksa (API kotası / geçici bağlantı kesintisi), doğal ve akıcı mesai arkadaşı yanıtı üret
  if (!assistantReply) {
    const lower = content.toLowerCase();

    if (lower.includes("durum") || lower.includes("status") || lower.includes("git")) {
      proposedCommand = "git status";
      commandDesc = `${projectName} yerel git çalışma durumunu kontrol et`;
      riskLevel = "low";
      assistantReply = `🔍 **${projectName}** projenizin yerel deposundaki güncel değişiklikleri ve git durumunu görmek için komutu hazırladım. İnceleyip onaylayabilirsiniz:`;
    } else if (lower.includes("test") || lower.includes("derle") || lower.includes("build")) {
      proposedCommand = "npm run build";
      commandDesc = `${projectName} üretim derlemesini test et`;
      riskLevel = "high";
      assistantReply = `🧪 **${projectName}** projenizin TypeScript tip ve derleme testlerini koşmak için komutu hazırladım. Onay verdiğinizde Mac Runner hemen çalıştıracak:`;
    } else if (lower.includes("deploy") || lower.includes("dağıt") || lower.includes("canlı")) {
      proposedCommand = deployCmd || "npm run build";
      commandDesc = `${projectName} canlı sunucuya dağıtım yap`;
      riskLevel = "critical";
      assistantReply = `🚀 **${projectName}** projesini canlı ortama dağıtmak için onayınız bekleniyor:`;
    } else {
      assistantReply = `⚡ **DevStudio:** Google AI Studio sunucularında anlık aşırı yoğunluk yaşandı ve modeller zaman aşımına uğradı.\n\nLütfen üst menüden **🚀 3-Flash (Hızlı & Kararlı)** modelini seçerek tekrar dener misiniz?`;
    }
  }

  // 6. Eğer komut varsa approvals tablosuna kaydet
  let createdApproval: any = null;
  if (proposedCommand) {
    const appr = await db
      .insert(approvals)
      .values({
        sessionId: chatSession.id,
        projectId,
        command: proposedCommand,
        description: commandDesc || `${projectName} komutu`,
        riskLevel,
        status: "pending",
      })
      .returning();

    createdApproval = appr[0];
  }

  // 7. Asistan mesajını kaydet
  const assistantMsg = await db
    .insert(chatMessages)
    .values({
      sessionId: chatSession.id,
      role: "assistant",
      content: assistantReply,
    })
    .returning();

  return {
    userMessage: userMsg[0],
    assistantMessage: assistantMsg[0],
    approval: createdApproval,
  };
}

export async function approveApprovalAction(approvalId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Yetkisiz erişim");

  await db
    .update(approvals)
    .set({
      status: "approved",
      respondedAt: new Date(),
    })
    .where(eq(approvals.id, approvalId));

  return { success: true };
}

export async function rejectApprovalAction(approvalId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Yetkisiz erişim");

  await db
    .update(approvals)
    .set({
      status: "rejected",
      respondedAt: new Date(),
    })
    .where(eq(approvals.id, approvalId));

  return { success: true };
}

export async function getApprovalStatusAction(approvalId: string) {
  const matched = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, approvalId))
    .limit(1);

  if (matched.length === 0) return null;

  return {
    id: matched[0].id,
    status: matched[0].status,
    output: matched[0].output,
    exitCode: matched[0].exitCode,
    analysis: matched[0].analysis,
    sessionId: matched[0].sessionId,
    projectId: matched[0].projectId,
  };
}
