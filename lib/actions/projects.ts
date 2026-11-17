"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createProjectAction(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Yetkisiz erişim");

  const name = formData.get("name") as string;
  const localPath = formData.get("localPath") as string;
  const repoUrl = formData.get("repoUrl") as string;
  const deployCommand = formData.get("deployCommand") as string;
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");

  await db.insert(projects).values({
    userId,
    name,
    slug,
    localPath,
    repoUrl: repoUrl || null,
    deployCommand: deployCommand || null,
    isDefault: false,
  });

  revalidatePath("/projects");
  revalidatePath("/chat");
  return { success: true };
}

export async function deleteProjectAction(projectId: string) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Yetkisiz erişim");

  await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

  revalidatePath("/projects");
  revalidatePath("/chat");
  return { success: true };
}
