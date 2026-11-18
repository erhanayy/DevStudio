import { extractGeminiText } from "@/lib/ai/gemini-parser";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { chatSessions, chatMessages, approvals, projects, userApiKeys } from "@/lib/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { decryptSecret } from "@/lib/crypto/vault";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const sessionId = searchParams.get("sessionId");
    const action = searchParams.get("action");

    // 0. Onay Durumu Sorgulama (REST polling - Server Action hash mismatch bağışık)
    if (action === "approval_status") {
      const approvalId = searchParams.get("approvalId");
      if (!approvalId) {
        return NextResponse.json({ error: "approvalId required" }, { status: 400 });
      }
      const matched = await db
        .select()
        .from(approvals)
        .where(eq(approvals.id, approvalId))
        .limit(1);

      if (matched.length === 0) return NextResponse.json(null);

      return NextResponse.json({
        id: matched[0].id,
        status: matched[0].status,
        output: matched[0].output,
        exitCode: matched[0].exitCode,
        analysis: matched[0].analysis,
      });
    }

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // 1. Yeni Oturum Oluşturma
    if (action === "new_session") {
      const created = await db
        .insert(chatSessions)
        .values({
          userId,
          projectId,
          title: "Yeni Sohbet",
        })
        .returning();

      return NextResponse.json({ session: created[0] });
    }

    // 2. Bu projenin tüm oturumlarını getir
    const sessions = await db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.userId, userId), eq(chatSessions.projectId, projectId)))
      .orderBy(desc(chatSessions.updatedAt));

    let activeSession = sessions[0];
    if (sessionId) {
      const found = sessions.find((s) => s.id === sessionId);
      if (found) activeSession = found;
    }

    // Eğer hiç oturum yoksa oluştur
    if (!activeSession) {
      const created = await db
        .insert(chatSessions)
        .values({
          userId,
          projectId,
          title: "Genel Geliştirme",
        })
        .returning();
      activeSession = created[0];
      sessions.push(activeSession);
    }

    // 3. Aktif oturumun mesajlarını ve onaylarını getir
    const rawMessages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, activeSession.id))
      .orderBy(asc(chatMessages.createdAt));

    const sessionApprovals = await db
      .select()
      .from(approvals)
      .where(eq(approvals.sessionId, activeSession.id));

    const messages = rawMessages.map((m) => {
      let app = sessionApprovals.find(
        (a) => a.sessionId === m.sessionId && m.role === 'assistant' && m.content.includes(a.command)
      );
      if (!app && m.role === 'assistant') {
        app = sessionApprovals.find(
          (a) =>
            a.sessionId === m.sessionId &&
            Math.abs(new Date(a.createdAt).getTime() - new Date(m.createdAt).getTime()) < 10000
        );
      }
      return {
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.createdAt,
        approval: app || null,
      };
    });

    return NextResponse.json({
      sessions,
      activeSession,
      messages,
    });
  } catch (error: any) {
    console.error("GET /api/chat error:", error);
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, approvalId } = body;

    // 0. Onay veya Red REST Aksiyonları (Server Action hash mismatch bağışık)
    if (action === "approve") {
      if (!approvalId) {
        return NextResponse.json({ error: "approvalId required" }, { status: 400 });
      }
      await db
        .update(approvals)
        .set({
          status: "approved",
          respondedAt: new Date(),
        })
        .where(eq(approvals.id, approvalId));

      return NextResponse.json({ success: true });
    }

    if (action === "reject") {
      if (!approvalId) {
        return NextResponse.json({ error: "approvalId required" }, { status: 400 });
      }
      await db
        .update(approvals)
        .set({
          status: "rejected",
          respondedAt: new Date(),
        })
        .where(eq(approvals.id, approvalId));

      return NextResponse.json({ success: true });
    }

    const { projectId, sessionId, model, content, isObservation } = body;

    if (!projectId || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Oturumu bul veya oluştur
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const existing = await db
        .select()
        .from(chatSessions)
        .where(and(eq(chatSessions.userId, userId), eq(chatSessions.projectId, projectId)))
        .orderBy(desc(chatSessions.updatedAt))
        .limit(1);

      if (existing.length > 0) {
        currentSessionId = existing[0].id;
      } else {
        const created = await db
          .insert(chatSessions)
          .values({
            userId,
            projectId,
            title: content.slice(0, 30) || "Geliştirme Sohbeti",
          })
          .returning();
        currentSessionId = created[0].id;
      }
    }

    // Proje bilgilerini getir
    const projectList = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    const currentProject = projectList[0];
    const projectName = currentProject?.name || "Proje";
    const projectPath = currentProject?.localPath || "";
    const deployCmd = currentProject?.deployCommand || "";

    // 1. Kullanıcı mesajı (Eğer observation değilse kaydet)
    let savedUserMsg: any = null;
    if (!isObservation) {
      const uRes = await db
        .insert(chatMessages)
        .values({
          sessionId: currentSessionId,
          role: "user",
          content,
        })
        .returning();
      savedUserMsg = uRes[0];
    }

    // 2. Geçmiş mesajları yükle (Çok turlu konuşma hafızası)
    const pastMessages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, currentSessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(10);

    const historyText = pastMessages
      .reverse()
      .map((m) => `${m.role === "user" ? "Kullanıcı" : m.role === "runner" ? "Mac Terminal Çıktısı" : "DevStudio"}: ${m.content}`)
      .join("\n\n");

    // 3. Kullanıcı API Anahtarını getir
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

    if (apiKey) {
      const candidateModels = [
        model && !model.includes("2.0") && !model.includes("3.8") ? model : "gemini-3.5-flash-lite",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
      ];

      const systemInstruction = `Sen DevStudio adında, kullanıcının mobil telefonundan veya bilgisayarından doğrudan pair-programming yaptığı samimi, zeki, vizyoner ve kıdemli bir Baş Yapay Zeka Mühendisisin (Staff AI Engineer).
Kullanıcı seninle Türkçe konuşuyor. Tıpkı Antigravity veya Claude ile yaptığı gibi tamamen serbest, doğal ve gündelik bir dille sohbet eder; mimari tartışır, soru sorar, fikir danışır veya geliştirme talep eder.
ASLA mekanik, kalıplaşmış veya robotik yanıt verme. Samimi, vizyoner, teknik olarak son derece yetkin ve çözüm odaklı bir mesai arkadaşı gibi ol.

Şu an aktif olan proje: "${projectName}"
Projenin kullanıcının bilgisayarındaki (Mac) yerel dizini: "${projectPath}"
Varsayılan dağıtım komutu: "${deployCmd}"

KURALLAR:
1. Eğer kullanıcının talebini yerine getirmek için bilgisayarında bir terminal komutu (git, npm, build, test, deploy, dosya okuma/yazma vb.) çalıştırmak gerekiyorsa:
   - Komutu mutlaka tek bir \`\`\`bash ... \`\`\` kod bloğu içerisine yaz.
   - Neden bu komutu önerdiğini kısaca açıkla.
2. Eğer sana bir [GÖZLEM / MAC RUNNER ÇIKTISI] gelmişse:
   - Komutun sonucunu detaylıca analiz et.
   - Ne gördüğünü, sonucun başarılı olup olmadığını açıkla.
   - Kullanıcıya "Sıradaki adımımız şudur, ne dersin?" diyerek bir sonraki adımı öner ve akışı asla kesme!
3. Cevaplarını asla yarım bırakma. Cümlelerini ve mantığını eksiksiz tamamla.`;

      const promptText = `${systemInstruction}\n\n--- SOHBET GEÇMİŞİ ---\n${historyText}\n\n${isObservation ? content : `Kullanıcı: ${content}`}`;

      for (const m of candidateModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);

          const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: {
                maxOutputTokens: 8192,
                temperature: 0.7,
              },
            }),
          });

          clearTimeout(timeout);

          if (resp.ok) {
            const json = await resp.json();
            const fullText = extractGeminiText(json);
            if (fullText) {
              assistantReply = fullText;

              const match = assistantReply.match(/```(?:bash|sh|shell)?\s*([\s\S]*?)```/);
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
              break;
            }
          }
        } catch (e) {
          // Sonraki modeli dene
        }
      }
    }

    if (!assistantReply) {
      if (isObservation) {
        assistantReply = `✅ **${projectName}** üzerindeki işlem tamamlandı! Çıktıyı inceledim. Sıradaki geliştirme adımımıza geçebiliriz, ne dersin?`;
      } else {
        assistantReply = `Harika bir konu Erhan! **${projectName}** projesi için aklındaki bu fikri birlikte adım adım hayata geçirelim: *"${content}"*\n\nSence önce mimariyi mi konuşalım, yoksa doğrudan kod tarafına mı geçelim? Ne düşünüyorsun?`;
      }
    }

    // 4. Onay Kartı Gerekiyorsa Oluştur
    let createdApproval: any = null;
    if (proposedCommand) {
      const appr = await db
        .insert(approvals)
        .values({
          sessionId: currentSessionId,
          projectId,
          command: proposedCommand,
          description: commandDesc || `${projectName} komutu`,
          riskLevel,
          status: "pending",
        })
        .returning();

      createdApproval = appr[0];
    }

    // 5. Asistan Yanıtını Kaydet
    const aRes = await db
      .insert(chatMessages)
      .values({
        sessionId: currentSessionId,
        role: "assistant",
        content: assistantReply,
      })
      .returning();

    // Oturum güncelleme zamanını yenile
    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, currentSessionId));

    return NextResponse.json({
      sessionId: currentSessionId,
      userMessage: savedUserMsg,
      assistantMessage: aRes[0],
      approval: createdApproval,
    });
  } catch (error: any) {
    console.error("POST /api/chat error:", error);
    return NextResponse.json({ error: error?.message || "Server error" }, { status: 500 });
  }
}
