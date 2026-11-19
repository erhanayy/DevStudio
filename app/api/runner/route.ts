import { extractGeminiText } from "@/lib/ai/gemini-parser";
import {
  extractLocalCliApproval,
  isLocalCliCommand,
  parseLocalCliCommand,
} from "@/lib/runner/local-cli";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runnerTokens, projects, approvals, chatMessages, userApiKeys } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { decryptSecret } from "@/lib/crypto/vault";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, action, deviceName, payload } = body;

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 401 });
    }

    const matched = await db
      .select()
      .from(runnerTokens)
      .where(eq(runnerTokens.token, token))
      .limit(1);

    if (matched.length === 0) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const runner = matched[0];

    // 1. Heartbeat ve İlk Bağlantı
    if (action === "heartbeat" || action === "connect") {
      await db
        .update(runnerTokens)
        .set({
          isOnline: true,
          lastSeenAt: new Date(),
          deviceName: deviceName || runner.deviceName,
        })
        .where(eq(runnerTokens.id, runner.id));

      // Kullanıcının kayıtlı projelerini getir
      const userProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.userId, runner.userId));

      // Kullanıcının onaylanmış ve çalışmayı bekleyen komutlarını ara
      const pendingApprovals = await db
        .select()
        .from(approvals)
        .where(eq(approvals.status, "approved"));

      // Bu kullanıcıya ait olanları eşle
      const projectMap = new Map(userProjects.map((p) => [p.id, p]));
      const pendingTasks: any[] = [];

      for (const appr of pendingApprovals) {
        if (appr.projectId && projectMap.has(appr.projectId)) {
          const prj = projectMap.get(appr.projectId)!;
          pendingTasks.push({
            approvalId: appr.id,
            command: appr.command,
            projectPath: prj.localPath,
            projectName: prj.name,
            description: appr.description,
          });
        }
      }

      return NextResponse.json({
        success: true,
        isOnline: true,
        projects: userProjects.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          localPath: p.localPath,
          repoUrl: p.repoUrl,
          deployCommand: p.deployCommand,
        })),
        pendingTasks,
      });
    }

    // 2. Görev Başlatıldı
    if (action === "task_started") {
      const { approvalId } = payload || {};
      if (approvalId) {
        await db
          .update(approvals)
          .set({ status: "running" })
          .where(eq(approvals.id, approvalId));
      }
      return NextResponse.json({ success: true });
    }

    // 3. Görev Tamamlandı (Runner çıktıyı sunucuya iletti -> Sunucu Otonom Analiz Eder!)
    if (action === "task_completed") {
      const { approvalId, output, exitCode } = payload || {};
      if (approvalId) {
        const cleanOutput = (output || "").trim();
        let finalExitCode = exitCode ?? 0;

        // Git: "nothing to commit, working tree clean" bir hata değil, temiz çalışma alanıdır
        if (finalExitCode === 1 && cleanOutput.includes("nothing to commit, working tree clean")) {
          finalExitCode = 0;
        }

        const finalStatus = finalExitCode === 0 ? "completed" : "failed";

        // İlgili onay kaydını bul
        const matchedAppr = await db
          .select()
          .from(approvals)
          .where(eq(approvals.id, approvalId))
          .limit(1);

        if (matchedAppr.length > 0) {
          const appr = matchedAppr[0];

          // A) YEREL CLI AJAN GÖREVİ (Antigravity agy / Claude / Gemini CLI)
          // Doğrudan ajan yanıtı döndüğü için bulut Gemini API çağrılmaz (0 ek maliyet & 0 timeout)
          if (payload?.isLocalCli || isLocalCliCommand(appr.command)) {
            const parsedMeta = parseLocalCliCommand(appr.command);
            const engineName = payload?.engine || parsedMeta?.engine || "cli";
            const modelName = payload?.model || parsedMeta?.model || "default";
            const modeName = (payload?.mode || parsedMeta?.mode) === "auto" ? "Geliştir" : "Plan";
            const durationSec =
              typeof payload?.durationSeconds === "number" && payload.durationSeconds > 0
                ? ` • ${payload.durationSeconds}s`
                : "";

            const extracted = extractLocalCliApproval(cleanOutput);
            const displayOutput = extracted.cleanText;

            const changedFiles: string[] = Array.isArray(payload?.changedFiles)
              ? payload.changedFiles.filter((f: unknown) => typeof f === "string" && f.trim())
              : [];

            let assistantReply = displayOutput || "(Yerel CLI ajanından boş yanıt döndü)";

            if (changedFiles.length > 0) {
              const fileLines = changedFiles.map((f) => `- \`${f}\``).join("\n");
              assistantReply += `\n\n---\n📝 **Değişen Dosyalar:**\n${fileLines}`;
            }

            const modelSuffix = modelName && modelName !== "default" ? ` • ${modelName}` : "";
            assistantReply += `\n\n*🖥️ Yerel Ajan (${engineName}${modelSuffix} • ${modeName}${durationSec})*`;

            await db.insert(chatMessages).values({
              sessionId: appr.sessionId,
              role: "assistant",
              content: assistantReply,
            });

            // Yerel Ajan mobil onay kartı istediyse (git push, gcloud deploy vb.) Runner'a özel bekleyen onay kartı oluştur
            if (extracted.approval?.command) {
              await db.insert(approvals).values({
                sessionId: appr.sessionId,
                projectId: appr.projectId,
                command: extracted.approval.command,
                description: extracted.approval.description,
                riskLevel: extracted.approval.riskLevel,
                status: "pending",
              });
            }

            await db
              .update(approvals)
              .set({
                status: finalStatus,
                output: displayOutput || cleanOutput,
                exitCode: finalExitCode,
                analysis: assistantReply,
              })
              .where(eq(approvals.id, approvalId));

            return NextResponse.json({ success: true });
          }

          // B) STANDART TERMINAL KOMUTU
          // Proje ve kullanıcı bağlamını al
          const projectList = appr.projectId
            ? await db.select().from(projects).where(eq(projects.id, appr.projectId)).limit(1)
            : [];
          const currentProject = projectList[0];
          const projectName = currentProject?.name || "Proje";
          const projectPath = currentProject?.localPath || "";
          const deployCmd = currentProject?.deployCommand || "";

          // Runner çıktısını chat_messages tablosuna ekle
          await db.insert(chatMessages).values({
            sessionId: appr.sessionId,
            role: "runner",
            content: `⚡ **Runner Çıktısı (MacBook):**\n\`\`\`bash\n${cleanOutput || "(Çıktı boş)"}\n\`\`\`\n*Durum: ${finalExitCode === 0 ? "✅ Başarılı (0)" : "❌ Hata (" + finalExitCode + ")" }*`,
          });

          // Kullanıcı Gemini API anahtarını çöz
          const keyRecords = await db
            .select()
            .from(userApiKeys)
            .where(and(eq(userApiKeys.userId, runner.userId), eq(userApiKeys.provider, "gemini")))
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

          // Geçmiş mesajları al
          const pastMessages = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.sessionId, appr.sessionId))
            .orderBy(desc(chatMessages.createdAt))
            .limit(8);

          const historyText = pastMessages
            .reverse()
            .map((m) => `${m.role === "user" ? "Kullanıcı" : m.role === "runner" ? "Mac Terminal Çıktısı" : "DevStudio"}: ${m.content}`)
            .join("\n\n");

          let assistantReply = "";
          let nextCommand: string | null = null;
          let nextDesc: string | null = null;
          let riskLevel: "low" | "medium" | "high" | "critical" = "medium";

          if (apiKey) {
            const systemInstruction = `Sen DevStudio adında, kullanıcının mobil telefonundan veya bilgisayarından doğrudan pair-programming yaptığı samimi, zeki, vizyoner ve kıdemli bir Baş Yapay Zeka Mühendisisin (Staff AI Engineer).
Kullanıcı seninle Türkçe konuşuyor. Tıpkı Antigravity veya Claude ile yaptığı gibi tamamen serbest, doğal ve gündelik bir dille sohbet eder; mimari tartışır, soru sorar, fikir danışır veya geliştirme talep eder.
ASLA mekanik, kalıplaşmış veya robotik yanıt verme. Samimi, vizyoner, teknik olarak son derece yetkin ve çözüm odaklı bir mesai arkadaşı gibi ol.

Şu an aktif olan proje: "${projectName}"
Projenin kullanıcının bilgisayarındaki (Mac) yerel dizini: "${projectPath}"
Varsayılan dağıtım komutu: "${deployCmd}"

GÖREVİN:
Mac Runner üzerinde bir terminal komutu çalıştırıldı ve çıktısı sana ulaştı.
1. Komutun çıktısını detaylıca incele ve kullanıcıya ne gördüğünü net, samimi ve teknik olarak açıkla.
2. Eğer "nothing to commit, working tree clean" durumu varsa, değişikliklerin zaten commit'lendiğini veya çalışma alanının temiz olduğunu belirt. Eğer gönderilmemiş commit'ler varsa "origin/main'e push edelim" de.
3. Sıradaki adımı söyle. Eğer sıradaki adım bir terminal komutu (git push, npm run build, test, deploy vb.) gerektiriyorsa:
   - Komutu mutlaka tek bir \`\`\`bash ... \`\`\` kod bloğu içerisine yaz.
4. Cümlelerini ve düşüncelerini ASLA yarım bırakma. Tam ve eksiksiz bir şekilde tamamla.`;

            const obsPrompt = `${systemInstruction}\n\n--- SOHBET GEÇMİŞİ ---\n${historyText}\n\n[MAC RUNNER TAMAMLANDI]:\nÇalıştırılan Komut: "${appr.command}"\nÇıkış Kodu: ${finalExitCode}\nTerminal Çıktısı:\n\`\`\`\n${cleanOutput || "(Çıktı boş)"}\n\`\`\`\n\nBu çıktıyı incele; kullanıcıya ne gördüğünü açıkla, işlemin bittiğini teyit et ve sıradaki adımı öner.`;

            const candidateModels = [
              "gemini-3-flash-preview", // 200 OK veren ve hızlı çalışan model
              "gemini-flash-lite-latest",
              "gemini-3.8-flash",
              "gemini-3.5-flash-lite",
            ];

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
                    contents: [{ parts: [{ text: obsPrompt }] }],
                    generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
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
                      nextCommand = match[1].trim();
                      nextDesc = `${projectName} üzerinde komut icra edilecek`;
                      riskLevel =
                        nextCommand.includes("deploy") || nextCommand.includes("push") || nextCommand.includes("rm")
                          ? "critical"
                          : nextCommand.includes("build") || nextCommand.includes("install")
                          ? "high"
                          : "low";
                    }
                    break;
                  }
                } else {
                  console.warn(`[Runner AI] ${m} başarısız (HTTP ${resp.status}), sonraki modele geçiliyor...`);
                }
              } catch (err: any) {
                console.warn(`[Runner AI] ${m} çağrısı zaman aşımı / hata:`, err?.message);
              }
            }
          }

          if (!assistantReply) {
            if (finalExitCode === 0) {
              assistantReply = `✅ **${projectName}** üzerindeki işlem başarıyla tamamlandı. Çıktıyı inceledim, her şey yolunda görünüyor. Sıradaki geliştirme adımımıza geçebiliriz, ne dersin?`;
            } else {
              assistantReply = `⚠️ **${projectName}** üzerindeki işlem kod ${finalExitCode} ile tamamlandı:\n\`\`\`\n${cleanOutput}\n\`\`\`\nSonucu birlikte inceleyip sıradaki adımı belirleyebiliriz. Nasıl ilerleyelim?`;
            }
          }

          // Asistan analiz mesajını ekle
          await db.insert(chatMessages).values({
            sessionId: appr.sessionId,
            role: "assistant",
            content: assistantReply,
          });

          // Eğer sıradaki komut varsa yeni bir onay kartı aç
          if (nextCommand) {
            await db.insert(approvals).values({
              sessionId: appr.sessionId,
              projectId: appr.projectId,
              command: nextCommand,
              description: nextDesc || `${projectName} komutu`,
              riskLevel,
              status: "pending",
            });
          }

          // Onay kartını tamamlandı yap ve analiz metnini mühürle
          await db
            .update(approvals)
            .set({
              status: finalStatus,
              output: cleanOutput,
              exitCode: finalExitCode,
              analysis: assistantReply,
            })
            .where(eq(approvals.id, approvalId));
        }
      }
      return NextResponse.json({ success: true });
    }

    // 4. Bağlantı Kesildi
    if (action === "disconnect") {
      await db
        .update(runnerTokens)
        .set({
          isOnline: false,
          lastSeenAt: new Date(),
        })
        .where(eq(runnerTokens.id, runner.id));

      return NextResponse.json({ success: true, isOnline: false });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Runner API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal runner error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const matched = await db
    .select()
    .from(runnerTokens)
    .where(eq(runnerTokens.token, token))
    .limit(1);

  if (matched.length === 0) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const row = matched[0];
  const isFreshOnline =
    Boolean(row.isOnline) &&
    row.lastSeenAt !== null &&
    Date.now() - new Date(row.lastSeenAt).getTime() < 90_000;

  return NextResponse.json({
    isOnline: isFreshOnline,
    lastSeenAt: row.lastSeenAt,
    deviceName: row.deviceName,
  });
}
