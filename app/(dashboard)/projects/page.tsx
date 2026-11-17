import { auth } from "@/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ProjectsView } from "./projects-view";

export default async function ProjectsPage() {
  const session = await auth();
  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, session!.user!.id!));

  return <ProjectsView projects={userProjects} />;
}
