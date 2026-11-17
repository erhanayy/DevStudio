import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "./lib/db";
import { users } from "./lib/db/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function getUserByIdentifier(identifier: string) {
  try {
    const trimmed = identifier.trim().toLowerCase();
    const result = await db
      .select()
      .from(users)
      .where(or(eq(users.email, trimmed), eq(users.username, trimmed), eq(users.phone, trimmed)))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("Kullanıcı arama hatası:", error);
    return null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({
            identifier: z.string().min(1, "E-posta veya kullanıcı adı gereklidir"),
            password: z.string().min(4, "Şifre en az 4 karakter olmalıdır"),
          })
          .safeParse(credentials);

        if (!parsedCredentials.success) {
          return null;
        }

        const { identifier, password } = parsedCredentials.data;
        const user = await getUserByIdentifier(identifier);

        if (!user) return null;
        if (user.status === "suspended") {
          throw new Error("Hesabınız askıya alınmıştır.");
        }

        const passwordsMatch = await bcrypt.compare(password, user.password);
        if (!passwordsMatch) return null;

        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          image: user.avatarUrl,
          role: user.role,
        };
      },
    }),
  ],
});
