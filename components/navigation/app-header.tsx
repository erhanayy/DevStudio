"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Terminal, MessageSquareCode, FolderGit2, KeyRound, LogOut, Radio } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import { logoutAction } from "@/lib/actions/auth";

interface AppHeaderProps {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
  isRunnerOnline?: boolean;
}

export function AppHeader({ user, isRunnerOnline = false }: AppHeaderProps) {
  const pathname = usePathname();
  const { t, locale, setLanguage } = useTranslation();

  const navLinks = [
    {
      href: "/chat",
      label: t("nav.chat") || "Dev Chat",
      icon: MessageSquareCode,
      active: pathname.startsWith("/chat"),
      colorClass: "text-cyan-400 hover:text-cyan-300",
      activeBg: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40",
    },
    {
      href: "/projects",
      label: t("nav.projects") || "Projelerim",
      icon: FolderGit2,
      active: pathname.startsWith("/projects"),
      colorClass: "text-emerald-400 hover:text-emerald-300",
      activeBg: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
    },
    {
      href: "/settings",
      label: t("nav.settings") || "Kasa",
      icon: KeyRound,
      active: pathname.startsWith("/settings"),
      colorClass: "text-purple-400 hover:text-purple-300",
      activeBg: "bg-purple-500/20 text-purple-400 border border-purple-500/40",
    },
  ];

  return (
    <header className="shrink-0 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 w-full max-w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-1 w-full max-w-full">
        {/* Sol Alan: Logo */}
        <div className="flex items-center gap-1.5 sm:gap-4 min-w-0 shrink">
          <Link href="/chat" className="flex items-center gap-1.5 group shrink-0">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/25 shrink-0">
              <Terminal className="w-3.5 h-3.5 sm:w-5 sm:h-5 stroke-[2.5]" />
            </div>
            <span className="font-black text-sm sm:text-lg text-white tracking-tight truncate">
              Dev<span className="text-cyan-400">Studio</span>
            </span>
          </Link>

          {/* Masaüstü Navigasyon Kapsülü */}
          <nav className="hidden sm:flex items-center gap-1 p-1 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-inner">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    link.active
                      ? link.activeBg
                      : `${link.colorClass} hover:bg-slate-800/60 border border-transparent`
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sağ Alan: Runner Durumu + Dil + Profil & Çıkış */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Runner Canlı Durum Rozeti */}
          <div
            className={`flex items-center gap-1 px-1.5 py-1 sm:px-2.5 rounded-lg sm:rounded-xl border text-[9px] sm:text-[11px] font-bold ${
              isRunnerOnline
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-slate-900/60 border-slate-800 text-slate-400"
            }`}
            title={isRunnerOnline ? "Mac / PC Runner Bağlı" : "Runner Çevrimdışı"}
          >
            <Radio className={`w-3 h-3 ${isRunnerOnline ? "animate-pulse text-emerald-400" : "text-slate-500"}`} />
            <span className="hidden md:inline">
              {isRunnerOnline ? t("chat.online") : t("chat.offline")}
            </span>
          </div>

          {/* Dil Değiştirici */}
          <button
            type="button"
            onClick={() => setLanguage(locale === "tr" ? "en" : "tr")}
            className="flex items-center justify-center gap-0.5 px-1.5 h-8 sm:h-[38px] rounded-lg sm:rounded-xl bg-slate-900/65 hover:bg-slate-800/80 border border-slate-800 text-[11px] font-bold text-slate-200 cursor-pointer"
            aria-label={t("nav.language")}
          >
            <span>{locale === "tr" ? "🇹🇷" : "🇬🇧"}</span>
            <span className="text-[10px] font-extrabold text-cyan-400 uppercase">{locale}</span>
          </button>

          {/* Profil Avatarı */}
          <div className="w-8 h-8 sm:w-[38px] sm:h-[38px] rounded-lg sm:rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black text-cyan-400 shrink-0">
            {user.name?.[0]?.toUpperCase() || "E"}
          </div>

          {/* Çıkış Yap */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-8 h-8 sm:w-[38px] sm:h-[38px] rounded-lg sm:rounded-xl text-rose-400 bg-slate-900/65 border border-slate-800 hover:border-rose-500/40 hover:bg-rose-500/10 cursor-pointer flex items-center justify-center shrink-0"
              aria-label={t("nav.logout")}
              title={t("nav.logout")}
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Mobil Alt Sekmeler */}
      <div className="sm:hidden flex items-center justify-around border-t border-slate-800/80 px-1 py-1 bg-slate-900/95 backdrop-blur-md">
        {navLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-bold transition-all ${
                link.active
                  ? `${link.colorClass} bg-slate-800/90 shadow-sm`
                  : `${link.colorClass} opacity-75 hover:opacity-100`
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
