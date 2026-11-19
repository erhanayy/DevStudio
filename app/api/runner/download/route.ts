import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const script = searchParams.get("script");

    let fileName = "devstudio-runner.mjs";
    if (script === "mac") {
      fileName = "start-runner-mac.sh";
    } else if (script === "windows") {
      fileName = "start-runner-windows.ps1";
    }

    const filePath = path.join(process.cwd(), "runner-cli", fileName);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Runner script not found" }, { status: 404 });
    }

    const content = fs.readFileSync(filePath, "utf8");
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("GET /api/runner/download error:", error);
    return NextResponse.json(
      { error: error?.message || "Download failed" },
      { status: 500 }
    );
  }
}

