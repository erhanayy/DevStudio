"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  fullName: z.string().min(2, "Ad Soyad en az 2 karakter olmalıdır"),
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
  phone: z.string().optional(),
  password: z.string().min(6, "Parola en az 6 karakter olmalıdır"),
});

export async function authenticate(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    const identifier = formData.get("identifier") as string;
    const password = formData.get("password") as string;

    await signIn("credentials", {
      identifier,
      password,
      redirectTo: "/chat",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Girdiğiniz e-posta/kullanıcı adı veya şifre hatalı.";
        default:
          return error.message || "Giriş yapılırken bir hata oluştu.";
      }
    }
    throw error;
  }
}

export async function registerUser(
  prevState: { success: boolean; message: string; error?: string } | undefined,
  formData: FormData
) {
  try {
    const rawData = {
      fullName: formData.get("fullName") as string,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || undefined,
      password: formData.get("password") as string,
    };

    const validated = registerSchema.safeParse(rawData);
    if (!validated.success) {
      return {
        success: false,
        message: "Lütfen alanları kontrol ediniz.",
        error: validated.error.errors[0]?.message,
      };
    }

    const { fullName, email, phone, password } = validated.data;
    const hashedPassword = await bcrypt.hash(password, 10);
    const username = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");

    await db.insert(users).values({
      fullName,
      email: email.toLowerCase(),
      phone,
      username,
      password: hashedPassword,
      role: "developer",
      status: "active",
    });

    return {
      success: true,
      message: "Kayıt başarılı! Şimdi giriş yapabilirsiniz.",
    };
  } catch (error: any) {
    console.error("Kayıt hatası:", error);
    if (error.code === "23505") {
      return {
        success: false,
        message: "Bu e-posta veya telefon numarası zaten kayıtlı.",
      };
    }
    return {
      success: false,
      message: "Kayıt oluşturulurken bir hata oluştu.",
    };
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
