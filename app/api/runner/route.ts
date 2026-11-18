import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runnerTokens, projects, approvals, chatMessages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

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

    // 3. Görev Tamamlandı (Runner çıktıyı sunucuya iletti)
    if (action === "task_completed") {
      const { approvalId, output, exitCode } = payload || {};
      if (approvalId) {
        const finalStatus = exitCode === 0 ? "completed" : "failed";

        const updated = await db
          .update(approvals)
          .set({
            status: finalStatus,
            output: output || "",
            exitCode: exitCode ?? 0,
          })
          .where(eq(approvals.id, approvalId))
          .returning();

        // Eğer onay bir sohbete bağlıysa, runner mesajı olarak ekle
        if (updated.length > 0 && updated[0].sessionId) {
          await db.insert(chatMessages).values({
            sessionId: updated[0].sessionId,
            role: "runner",
            content: `⚡ **Runner Çıktısı (MacBook):**\n\`\`\`bash\n${output || "(Çıktı boş)"}\n\`\`\`\n*Durum: ${exitCode === 0 ? "✅ Başarılı (0)" : "❌ Hata (" + exitCode + ")" }*`,
          });
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

  return NextResponse.json({
    isOnline: matched[0].isOnline,
    lastSeenAt: matched[0].lastSeenAt,
    deviceName: matched[0].deviceName,
  });
}
