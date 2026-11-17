"use client";

import { useState } from "react";
import { KeyRound, ShieldCheck, Terminal, Copy, Check, RefreshCw, Cpu, Lock } from "lucide-react";
import { saveApiKeysAction, regenerateRunnerTokenAction } from "@/lib/actions/settings";
import { useTranslation } from "@/lib/i18n/context";
import { toast } from "sonner";

interface SettingsViewProps {
  runnerToken: string;
  hasGeminiKey: boolean;
  hasClaudeKey: boolean;
  hasOpenaiKey: boolean;
}

export function SettingsView({
  runnerToken: initialToken,
  hasGeminiKey,
  hasClaudeKey,
  hasOpenaiKey,
}: SettingsViewProps) {
  const { t } = useTranslation();
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const runnerCommand = `npx devstudio-runner --token=${token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(runnerCommand);
    setCopied(true);
    toast.success("Runner komutu panoya kopyalandı!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveKeys = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const formData = new FormData(e.currentTarget);
      await saveApiKeysAction(formData);
      toast.success("API anahtarları şifrelenerek güvenle kaydedildi!");
    } catch (err: any) {
      toast.error(err.message || "Kaydetme başarısız");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!confirm("Eşleşme anahtarını yenilemek bilgisayarınızdaki mevcut bağlantıyı keser. Devam edilsin mi?")) return;
    setIsRegenerating(true);
    try {
      const res = await regenerateRunnerTokenAction();
      setToken(res.token);
      toast.success("Yeni Runner anahtarı üretildi!");
    } catch (err: any) {
      toast.error(err.message || "Yenileme başarısız");
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-6">
      {/* Üst Başlık */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-purple-400" />
          <span>{t("settings.title")}</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          {t("settings.desc")}
        </p>
      </div>

      {/* 1. Masaüstü Runner Eşleşme Kartı */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {t("settings.runnerTitle")}
              </h3>
              <p className="text-xs text-slate-400">
                Mac veya Windows bilgisayarınızda bir kez çalıştırmanız yeterlidir (Port açma gerekmez).
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isRegenerating}
            onClick={handleRegenerateToken}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Yeni Token Üret"
          >
            <RefreshCw className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Komut Kutusu */}
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-300">
          <span className="flex-1 truncate select-all">{runnerCommand}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Kopyalandı!" : t("settings.copyToken")}</span>
          </button>
        </div>
      </div>

      {/* 2. AI Sağlayıcıları Kasası (BYOK - AES-256) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>{t("settings.apiVaultTitle")}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                AES-256 Şifreli Kasa
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              API anahtarlarınız veritabanımızda askeri düzeyde şifrelenir; asla düz metin saklanmaz.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveKeys} className="space-y-4">
          {/* Gemini API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-300">
                {t("settings.geminiKey")}
              </label>
              {hasGeminiKey && (
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Tanımlı
                </span>
              )}
            </div>
            <input
              name="geminiKey"
              type="password"
              placeholder={hasGeminiKey ? "••••••••••••••••••••••••••••••••" : "AIzaSy..."}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
            <p className="text-[11px] text-cyan-400/90">
              💡 {t("settings.geminiHint")}
            </p>
          </div>

          {/* Claude API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-300">
                {t("settings.claudeKey")}
              </label>
              {hasClaudeKey && (
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Tanımlı
                </span>
              )}
            </div>
            <input
              name="claudeKey"
              type="password"
              placeholder={hasClaudeKey ? "••••••••••••••••••••••••••••••••" : "sk-ant-..."}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* OpenAI API Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-300">
                {t("settings.openaiKey")}
              </label>
              {hasOpenaiKey && (
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Tanımlı
                </span>
              )}
            </div>
            <input
              name="openaiKey"
              type="password"
              placeholder={hasOpenaiKey ? "••••••••••••••••••••••••••••••••" : "sk-proj-..."}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-purple-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? "Şifreleniyor..." : t("settings.saveKeys")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
