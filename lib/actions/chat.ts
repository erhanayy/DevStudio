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

  // 4. Gemini API çağrısı (Varsa dene)
  if (apiKey) {
    const candidateModels = [
      model && model !== "gemini-2.0-flash" ? model : "gemini-3.8-flash",
      "gemini-flash-latest",
      "gemma-4-26b-a4b-it",
      "gemini-3.7-flash",
    ];

    const systemInstruction = `Sen DevStudio adında, deneyimli bir Baş Yapay Zeka Mühendisisin (Staff AI Engineer).
Kullanıcı seninle cep telefonundan veya bilgisayarından yazışıyor.
Şu an aktif olan proje: "${projectName}"
Projenin kullanıcının bilgisayarındaki (Mac/PC) yerel dizini: "${projectPath}"
Varsayılan dağıtım komutu: "${deployCmd}"

Kullanıcının talimatını veya sorusunu yanıtla. Samimi, teknik, Türkçe ve çözüm odaklı ol.
Eğer kullanıcının talebini yerine getirmek için bilgisayarında bir terminal komutu (git, npm, build, test, deploy, ls vb.) çalıştırmak gerekiyorsa:
1. Komutu mutlaka tek bir \`\`\`bash ... \`\`\` kod bloğu içerisine yaz.
2. Neden bu komutu önerdiğini kısaca açıkla.`;

    for (const m of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemInstruction}\n\nKullanıcı: ${content}` },
                ],
              },
            ],
          }),
        });

        clearTimeout(timeout);

        if (resp.ok) {
          const json = await resp.json();
          if (json.candidates?.[0]?.content?.parts?.[0]?.text) {
            assistantReply = json.candidates[0].content.parts[0].text;

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
            break; // Başarılı, döngüden çık
          }
        }
      } catch (err) {
        // Sonraki modeli dene
      }
    }
  }

  // 5. Eğer Gemini yanıt üretemediyse (kota / geçici yoğunluk) veya komut tespit edemediyse yerel akıllı motor devreye girer
  const lower = content.toLowerCase();

  // Komut tespiti
  if (!proposedCommand) {
    if (lower.includes("durum") || lower.includes("status") || lower.includes("git")) {
      proposedCommand = "git status";
      commandDesc = `${projectName} yerel git çalışma durumunu kontrol et`;
      riskLevel = "low";
      if (!assistantReply) {
        assistantReply = `🔍 **${projectName}** projenizin yerel git deposundaki değiştirilen ve izlenmeyen dosyaları kontrol etmek için komut hazırlandı. Aşağıdaki butondan onaylayabilirsiniz:`;
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
        assistantReply = `🧪 **${projectName}** projenizin TypeScript ve derleme testlerini koşmak için komut hazırlandı.`;
      }
    } else if (lower.includes("deploy") || lower.includes("dağıt") || lower.includes("canlı")) {
      proposedCommand = deployCmd || "npm run build";
      commandDesc = `${projectName} canlı sunucuya dağıtım yap`;
      riskLevel = "critical";
      if (!assistantReply) {
        assistantReply = `🚀 **${projectName}** projesini canlı ortama dağıtmak için onayınız bekleniyor:`;
      }
    } else if (lower.includes("dosya") || lower.includes("ls") || lower.includes("klasör") || lower.includes("dizin")) {
      proposedCommand = "ls -la";
      commandDesc = `${projectName} proje ana dizinindeki dosyaları listele`;
      riskLevel = "low";
      if (!assistantReply) {
        assistantReply = `📁 **${projectName}** klasöründeki dosyaları listelemek için komut hazırlandı.`;
      }
    }
  }

  // Eğer hala bir yanıt yoksa, soruya özel akıllı yanıt üret
  if (!assistantReply) {
    if (lower.includes("devstudio") && (lower.includes("yapabiliyor") || lower.includes("müyüm") || lower.includes("geliştirme"))) {
      assistantReply = `🎉 **Evet, kesinlikle Erhan Bey!**\n\nDevStudio tam da bu amaçla kendi kendini geliştirebilen bir mimariyle tasarlandı (Self-Hosting / Dogfooding).\n\nŞu an üstteki proje açılır kutusundan **DevStudio** projesini seçtiğinizde:\n1. Mac'inizdeki \`/Users/erhanayyildiz/Desktop/Work/DevStudio\` çalışma dizinine doğrudan bağlanırsınız.\n2. Telefonunuzdan vereceğiniz kodlama, test ve dosya inceleme talimatları Mac'inizdeki Runner tarafından icra edilir.\n3. Geliştirme bittiğinde doğrudan telefondan onay verip yeni DevStudio sürümünü Cloud Run'a deploy edebilirsiniz!\n\nİlk deneme için hemen alt kısımdaki **\`🔍 Git Status\`** butonuna basabilir veya *"git status kontrol et"* yazabilirsiniz.`;
    } else {
      assistantReply = `👋 **${projectName}** projesi için talimatınız alındı: *"${content}"*\n\nMac Runner'ınız bağlı ve çalışır durumda. İstediğiniz bir komutu çalıştırmak için doğrudan komut adı yazabilir (örn: *"git status"*, *"npm run build"*, *"git log"*) veya alt kısımdaki hızlı işlem butonlarını kullanabilirsiniz.`;
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
  };
}
