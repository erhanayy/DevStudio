import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runnerTokens, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, action, deviceName } = body;

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

    if (action === "heartbeat" || action === "connect") {
      await db
        .update(runnerTokens)
        .set({
          isOnline: true,
          lastSeenAt: new Date(),
          deviceName: deviceName || runner.deviceName,
        })
        .where(eq(runnerTokens.id, runner.id));

      const userProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.userId, runner.userId));

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
      });
    }

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
