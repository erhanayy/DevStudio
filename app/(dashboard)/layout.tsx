import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/navigation/app-header";
import { db } from "@/lib/db";
import { runnerTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Runner durumunu sorgula
  const tokens = await db
    .select()
    .from(runnerTokens)
    .where(eq(runnerTokens.userId, session.user.id!))
    .limit(1);

  const isRunnerOnline = tokens[0]?.isOnline || false;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <AppHeader user={session.user} isRunnerOnline={isRunnerOnline} />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
