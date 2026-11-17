"use client";

import { useActionState } from "react";
import { authenticate } from "@/lib/actions/auth";
import Link from "next/link";
import { Terminal, Lock, User, ArrowRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

export function LoginForm() {
  const { t } = useTranslation();
  const [errorMessage, formAction, isPending] = useActionState(
    authenticate,
    undefined
  );

  return (
    <form action={formAction} className="space-y-4">
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold animate-in fade-in">
          {errorMessage}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          {t("auth.emailOrPhone")}
        </label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            name="identifier"
            type="text"
            required
            defaultValue="erhanayyildiz"
            placeholder="ornek@email.com veya kullanıcı adı"
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          {t("auth.password")}
        </label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            name="password"
            type="password"
            required
            placeholder="••••••••"
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 transition-all"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full min-h-[46px] py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-sm shadow-lg shadow-cyan-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 group disabled:opacity-50"
      >
        {isPending ? (
          <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span>{t("auth.loginBtn")}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </>
        )}
      </button>

      <div className="text-center pt-2 text-xs text-slate-400">
        <span>{t("auth.registerPrompt")} </span>
        <Link href="/register" className="text-cyan-400 font-bold hover:underline">
          {t("auth.registerLink")}
        </Link>
      </div>
    </form>
  );
}
