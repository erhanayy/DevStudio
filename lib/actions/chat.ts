"use server";

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

  let assistantReply = "";
  let proposedCommand: string | null = null;
  let commandDesc: string | null = null;
  let riskLevel: "low" | "medium" | "high" | "critical" = "medium";

  // Eğer Gemini API anahtarı varsa gerçek Gemini modeline sor
  if (apiKey) {
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = `Sen DevStudio adında, deneyimli bir Baş Yapay Zeka Mühendisisin (Staff AI Engineer).
Kullanıcı seninle cep telefonundan yazışıyor.
Şu an aktif olan proje: "${projectName}"
Projenin kullanıcının bilgisayarındaki (Mac/PC) yerel dizini: "${projectPath}"
Varsayılan dağıtım komutu: "${deployCmd}"

Kullanıcının talimatını analiz et. Türkçe, öz, teknik ve yapıcı cevap ver.
Eğer kullanıcının talebini yerine getirmek için bilgisayarında bir terminal komutu (git, npm, build, test, deploy, dosya inceleme vb.) çalıştırmak gerekiyorsa:
1. Komutu mutlaka tek bir \`\`\`bash kod bloğu içerisine yaz.
2. Neden bu komutu çalıştırmak istediğini kısaca açıkla.
Eğer sadece soru soruyorsa komut bloğu ekleme, doğrudan açıkla.`;

      const response = await ai.models.generateContent({
        model: model.includes("pro") ? "gemini-1.5-pro" : "gemini-2.0-flash",
        contents: content,
        config: {
          systemInstruction,
          temperature: 0.3,
        },
      });

      assistantReply = response.text || "Analiz tamamlandı.";

      // Yanıt içinde ```bash komut bloğu var mı kontrol et
      const match = assistantReply.match(/```(?:bash|sh|shell)?\s*([\s\S]*?)```/);
      if (match && match[1]) {
        proposedCommand = match[1].trim();
        commandDesc = `${projectName} üzerinde komut icra edilecek`;
        riskLevel = proposedCommand.includes("deploy") || proposedCommand.includes("push") || proposedCommand.includes("rm")
          ? "critical"
          : proposedCommand.includes("build") || proposedCommand.includes("install")
          ? "high"
          : "low";
      }
    } catch (err: any) {
      console.error("Gemini API çağrı hatası:", err);
      assistantReply = `⚠️ Gemini API yanıt veremedi (${err.message}). Yerel geliştirici motoru devrede.`;
    }
  }

  // Eğer API anahtarı yoksa veya Gemini komut belirlemediyse, akıllı geliştirici kurallarını uygula
  if (!proposedCommand) {
    const lower = content.toLowerCase();
    if (lower.includes("durum") || lower.includes("status") || lower.includes("git")) {
      proposedCommand = "git status";
      commandDesc = `${projectName} yerel git çalışma durumunu kontrol et`;
      riskLevel = "low";
      if (!assistantReply) {
        assistantReply = `🔍 **${projectName}** projenizin yerel git deposundaki değiştirilen ve izlenmeyen dosyaları kontrol etmek için komut hazırlandı.`;
      }
    } else if (lower.includes("commit") || lower.includes("geçmiş") || lower.includes("log")) {
      proposedCommand = "git log -n 5 --oneline";
      commandDesc = `${projectName} son 5 commit geçmişini listele`;
      riskLevel = "low";
      if (!assistantReply) {
        assistantReply = `📜 **${projectName}** projesindeki en son 5 git commit'ini listelemek için komut hazırlandı.`;
      }
    } else if (lower.includes("test") || lower.includes("derle") || lower.includes("build")) {
      proposedCommand = "npm run build";
      commandDesc = `${projectName} üretim derlemesini test et`;
      riskLevel = "high";
      if (!assistantReply) {
        assistantReply = `🧪 **${projectName}** projenizin TypeScript ve Next.js derleme testlerini koşmak için onay bekleniyor.`;
      }
    } else if (lower.includes("deploy") || lower.includes("dağıt") || lower.includes("canlı")) {
      proposedCommand = deployCmd || "npm run build";
      commandDesc = `${projectName} canlı sunucuya dağıtım yap`;
      riskLevel = "critical";
      if (!assistantReply) {
        assistantReply = `🚀 **${projectName}** projesini canlı ortama dağıtmak için onayınız bekleniyor:`;
      }
    } else if (lower.includes("dosya") || lower.includes("ls") || lower.includes("klasör")) {
      proposedCommand = "ls -la";
      commandDesc = `${projectName} proje ana dizinindeki dosyaları listele`;
      riskLevel = "low";
      if (!assistantReply) {
        assistantReply = `📁 **${projectName}** klasöründeki dosyaları incelemek için onayınız bekleniyor.`;
      }
    } else {
      if (!assistantReply) {
        assistantReply = `👋 **${projectName}** projesi için talimatınız alındı: *"${content}"*\n\n💡 İpucu: Üst menüden **Kasa & Eşleşme (/settings)** sekmesine giderek Google AI Studio Gemini API anahtarınızı tanımlarsanız sınırsız kod analizi ve sohbet yapabilirsiniz. Doğrudan komut çalıştırmak için *"git status kontrol et"*, *"testleri koş"* veya *"canlıya deploy et"* yazabilirsiniz.`;
      }
    }
  }

  // 4. Eğer komut varsa approvals tablosuna kaydet
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

  // 5. Asistan mesajını kaydet
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
  };
}
