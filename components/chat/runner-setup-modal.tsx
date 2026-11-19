"use client";

import { useState, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Laptop,
  Terminal,
  ShieldCheck,
  Sparkles,
  Wifi,
  WifiOff,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface RunnerSetupModalProps {
  open: boolean;
  onClose: () => void;
  runnerToken: string;
  initialOnline?: boolean;
  initialDeviceName?: string;
  onStatusChange?: (online: boolean, deviceName: string) => void;
}

export function RunnerSetupModal({
  open,
  onClose,
  runnerToken,
  initialOnline = false,
  initialDeviceName = "",
  onStatusChange,
}: RunnerSetupModalProps) {
  const [osTab, setOsTab] = useState<"mac" | "windows">("mac");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>(
    "https://devstudio-51645421078.europe-west1.run.app"
  );
  const [isOnline, setIsOnline] = useState<boolean>(initialOnline);
  const [deviceName, setDeviceName] = useState<string>(initialDeviceName);

  useEffect(() => {
    setIsOnline(initialOnline);
  }, [initialOnline]);

  useEffect(() => {
    setDeviceName(initialDeviceName);
  }, [initialDeviceName]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location?.origin) {
      setOrigin(window.location.origin);
      const ua = navigator.userAgent || "";
      if (/Windows/i.test(ua)) {
        setOsTab("windows");
      }
    }
  }, []);

  // Modal açıkken canlı bağlantı durumunu her 4 saniyede bir kontrol et
  useEffect(() => {
    if (!open || !runnerToken) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/runner?token=${encodeURIComponent(runnerToken)}`);
        if (!res.ok) return;
        const data = await res.json();
        const nextOnline = Boolean(data.isOnline);
        const nextDevice = data.deviceName || "";
        setIsOnline(nextOnline);
        setDeviceName(nextDevice);
        onStatusChange?.(nextOnline, nextDevice);
      } catch {
        // sessiz geç
      }
    };

    checkStatus();
    const timer = setInterval(checkStatus, 4000);
    return () => clearInterval(timer);
  }, [open, runnerToken, onStatusChange]);

  if (!open) return null;

  const copyText = async (id: string, text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedId(id);
      toast.success("Komut panoya kopyalandı!");
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch {
      toast.error("Kopyalanamadı");
    }
  };

  const quickStartCmd =
    osTab === "mac"
      ? `curl -fsSL ${origin}/api/runner/download -o devstudio-runner.mjs && node devstudio-runner.mjs --token=${runnerToken}`
      : `irm ${origin}/api/runner/download -OutFile devstudio-runner.mjs; node devstudio-runner.mjs --token=${runnerToken}`;

  const vacationCmd =
    osTab === "mac"
      ? `curl -fsSL "${origin}/api/runner/download?script=mac" -o start-runner-mac.sh && chmod +x start-runner-mac.sh && ./start-runner-mac.sh --token=${runnerToken}`
      : `irm "${origin}/api/runner/download?script=windows" -OutFile start-runner-windows.ps1; .\\start-runner-windows.ps1 -Token "${runnerToken}"`;

  const cliInstallClaude = "npm install -g @anthropic-ai/claude-code";
  const cliInstallGemini = "npm install -g @google/gemini-cli";

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[92dvh] bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Üst Başlık */}
        <div className="shrink-0 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Laptop className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white truncate">
                PC / Mac Runner Kurulum Rehberi
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Port açmadan 1 dakikada bağla • Ek API maliyeti olmadan Yerel CLI çalıştır
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* İçerik (Dikey Kaydırma, Sıfır Yatay Taşma) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 min-h-0">
          {/* Canlı Bağlantı Durumu Banner */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
              isOnline
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                : "bg-slate-950 border-slate-800 text-slate-300"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {isOnline ? (
                <Wifi className="w-5 h-5 text-emerald-400 shrink-0 animate-pulse" />
              ) : (
                <WifiOff className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-extrabold truncate">
                  {isOnline
                    ? `Bağlı: ${deviceName || "Bilgisayarınız Online"}`
                    : "Bilgisayar Bağlantısı Bekleniyor"}
                </p>
                <p className="text-[11px] opacity-80 truncate">
                  {isOnline
                    ? "Telefondan Yerel Ajan (CLI) veya terminal komutu gönderebilirsiniz."
                    : "Aşağıdaki 3. adımdaki komutu çalıştırdığınızda burası otomatik yeşile döner."}
                </p>
              </div>
            </div>
            <span
              className={`text-[10px] font-black uppercase px-2 py-1 rounded-full shrink-0 ${
                isOnline
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
              }`}
            >
              {isOnline ? "ONLINE" : "OFFLINE"}
            </span>
          </div>

          {/* İşletim Sistemi Sekmeleri (macOS / Windows) */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => setOsTab("mac")}
              className={`min-h-[44px] rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                osTab === "mac"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>🍎 macOS / Linux</span>
            </button>
            <button
              type="button"
              onClick={() => setOsTab("windows")}
              className={`min-h-[44px] rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                osTab === "windows"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>🪟 Windows (PowerShell)</span>
            </button>
          </div>

          {/* ADIM 1: Node.js */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-cyan-400">ADIM 1 • Node.js 18+ Kontrolü</span>
              <a
                href="https://nodejs.org"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-slate-400 hover:text-cyan-300 inline-flex items-center gap-1"
              >
                <span>nodejs.org</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {osTab === "mac"
                ? "Mac Terminal uygulamasını açın. Node.js yüklü değilse nodejs.org'dan LTS sürümünü kurun."
                : "Windows Başlat menüsünden PowerShell'i açın. Node.js yüklü değilse nodejs.org'dan LTS sürümünü kurun."}
            </p>
          </div>

          {/* ADIM 2: Yerel AI CLI */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="text-xs font-black text-purple-300">
                ADIM 2 • Yerel Yapay Zeka CLI (En Az Biri)
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Bilgisayarınızda kurulu olan AI CLI aracı otomatik algılanır ve mevcut aboneliğinizi kullanarak{" "}
              <strong className="text-emerald-300">ek API maliyeti olmadan</strong> kod geliştirir:
            </p>
            <div className="space-y-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200">
                <span className="font-bold text-cyan-300">• Antigravity CLI (`agy`):</span>{" "}
                Antigravity uygulaması kuruluysa hazırdır (Gemini 4 Neon, Hydrogen, 3.8 Flash, Claude 5.5).
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-bold text-amber-300 block">• Claude Code CLI:</span>
                  <code className="text-slate-300 font-mono break-all">{cliInstallClaude}</code>
                </div>
                <button
                  type="button"
                  onClick={() => copyText("claude-cli", cliInstallClaude)}
                  className="min-w-[44px] min-h-[44px] px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center shrink-0 cursor-pointer"
                  title="Kopyala"
                >
                  {copiedId === "claude-cli" ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-bold text-blue-300 block">• Gemini CLI:</span>
                  <code className="text-slate-300 font-mono break-all">{cliInstallGemini}</code>
                </div>
                <button
                  type="button"
                  onClick={() => copyText("gemini-cli", cliInstallGemini)}
                  className="min-w-[44px] min-h-[44px] px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center shrink-0 cursor-pointer"
                  title="Kopyala"
                >
                  {copiedId === "gemini-cli" ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ADIM 3: Tek Komutla Başlatma */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/30 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-xs font-black text-cyan-300">
                ADIM 3 • Tek Komutla İndir ve Başlat ({osTab === "mac" ? "Terminal" : "PowerShell"})
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Kişisel eşleşme anahtarınız aşağıya otomatik yerleştirildi. Kopyalayıp{" "}
              {osTab === "mac" ? "Terminal'e" : "PowerShell'e"} yapıştırmanız yeterli:
            </p>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-cyan-300 break-all select-all">
              {quickStartCmd}
            </div>
            <button
              type="button"
              onClick={() => copyText("quick-start", quickStartCmd)}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {copiedId === "quick-start" ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Komut Kopyalandı!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Tek Komutu Kopyala</span>
                </>
              )}
            </button>
          </div>

          {/* ADIM 4: 7/24 & Tatil Modu (Uyku Korumalı) */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-xs font-black text-emerald-300">
                ADIM 4 • 7/24 & Tatil Modu (Uyku Engelleme + Otomatik Yeniden Başlatma)
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Bilgisayar başından günlerce ayrılacaksanız bu komutu kullanın.{" "}
              {osTab === "mac"
                ? "Mac'i uykuya geçirmez (caffeinate) ve ağ kopsa bile 3 sn içinde yeniden bağlanır."
                : "Windows'u uykuya geçirmez ve bağlantı kopsa bile 3 sn içinde otomatik yeniden bağlanır."}
            </p>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-300 break-all select-all">
              {vacationCmd}
            </div>
            <button
              type="button"
              onClick={() => copyText("vacation-start", vacationCmd)}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {copiedId === "vacation-start" ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>7/24 Komutu Kopyalandı!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>7/24 Uyku Korumalı Komutu Kopyala</span>
                </>
              )}
            </button>
          </div>

          {/* Proje Dizin Yolu İpucu */}
          <p className="text-[11px] text-slate-400 leading-relaxed px-1">
            💡 <strong className="text-slate-300">Not:</strong> Windows kullanıyorsanız{" "}
            <strong className="text-white">Projeler</strong> sayfasında yerel dizin yolunu Windows formatında (örn.{" "}
            <code className="text-cyan-300">C:\Projects\MyApp</code>) tanımlamanız yeterlidir.
          </p>
        </div>
      </div>
    </div>
  );
}

