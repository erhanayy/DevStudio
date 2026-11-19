"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, CheckCircle2, XCircle, Terminal, AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

interface ApprovalCardProps {
  id: string;
  command: string;
  description: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected" | "running" | "completed" | "failed";
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

export function ApprovalCard({
  id,
  command,
  description,
  riskLevel,
  status: initialStatus,
  onApprove,
  onReject,
}: ApprovalCardProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(15);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (status === "approved" || status === "running") {
      setProgress(20);
      setSeconds(1);

      const secTimer = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);

      const progTimer = setInterval(() => {
        setProgress((p) => {
          if (p < 80) return p + Math.floor(Math.random() * 8) + 4;
          if (p < 94) return p + 1;
          return p;
        });
      }, 600);

      return () => {
        clearInterval(secTimer);
        clearInterval(progTimer);
      };
    } else if (status === "completed") {
      setProgress(100);
    }
  }, [status]);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove(id);
      setStatus("approved");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await onReject(id);
      setStatus("rejected");
    } finally {
      setLoading(false);
    }
  };

  const isTerminalState = status === "completed" || status === "failed" || status === "rejected";

  const riskColors = {
    low: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    medium: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    high: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    critical: `text-rose-400 bg-rose-500/10 border-rose-500/30 ${isTerminalState ? "" : "animate-pulse"}`,
  };

  const statusConfig = {
    pending: {
      border: "border-amber-500/40",
      iconBox: "bg-amber-500/15 border-amber-500/30 text-amber-400",
      icon: <ShieldAlert className="w-4 h-4" />,
      title: "İşlem Onayı Gerekiyor",
      titleColor: "text-white",
      desc: description,
    },
    approved: {
      border: "border-cyan-500/40 shadow-cyan-950/20",
      iconBox: "bg-cyan-500/15 border-cyan-500/30 text-cyan-400",
      icon: <Loader2 className="w-4 h-4 animate-spin" />,
      title: "İşlem Yürütülüyor...",
      titleColor: "text-cyan-300",
      desc: "Mac Runner terminal üzerinde komutu icra ediyor...",
    },
    running: {
      border: "border-cyan-500/40 shadow-cyan-950/20",
      iconBox: "bg-cyan-500/15 border-cyan-500/30 text-cyan-400",
      icon: <Loader2 className="w-4 h-4 animate-spin" />,
      title: "İşlem Yürütülüyor...",
      titleColor: "text-cyan-300",
      desc: "Mac Runner terminal üzerinde komutu icra ediyor...",
    },
    completed: {
      border: "border-emerald-500/50 shadow-emerald-950/20",
      iconBox: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
      icon: <CheckCircle2 className="w-4 h-4" />,
      title: "İşlem Tamamlandı",
      titleColor: "text-emerald-300",
      desc: "Komut başarıyla çalıştırıldı ve çıktısı işlendi",
    },
    failed: {
      border: "border-rose-500/40 shadow-rose-950/20",
      iconBox: "bg-rose-500/15 border-rose-500/30 text-rose-400",
      icon: <AlertTriangle className="w-4 h-4" />,
      title: "İşlem Tamamlandı (Hata)",
      titleColor: "text-rose-300",
      desc: "Komut çalıştırıldı ancak hata döndü",
    },
    rejected: {
      border: "border-slate-800",
      iconBox: "bg-slate-800 border-slate-700 text-slate-400",
      icon: <XCircle className="w-4 h-4" />,
      title: "İşlem Reddedildi",
      titleColor: "text-slate-400",
      desc: "Kullanıcı tarafından iptal edildi",
    },
  };

  const currentCfg = statusConfig[status] || statusConfig.pending;

  return (
    <div className={`rounded-3xl bg-slate-900 border-2 ${currentCfg.border} p-3.5 sm:p-5 shadow-2xl space-y-3.5 my-3 animate-in fade-in zoom-in-95 duration-200 w-full max-w-full overflow-hidden`}>
      {/* Üst Başlık & Risk Seviyesi */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-xl border ${currentCfg.iconBox} flex items-center justify-center shrink-0`}>
            {currentCfg.icon}
          </div>
          <div className="min-w-0 truncate">
            <h4 className={`text-xs sm:text-sm font-extrabold ${currentCfg.titleColor} flex items-center gap-1.5 truncate`}>
              <span>{currentCfg.title}</span>
            </h4>
            <p className="text-[11px] text-slate-400 truncate">{currentCfg.desc}</p>
          </div>
        </div>

        <span
          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${riskColors[riskLevel]}`}
        >
          {riskLevel}
        </span>
      </div>

      {/* Komut Kutusu */}
      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-amber-300 break-all select-all flex items-start gap-2 max-w-full overflow-hidden">
        <Terminal className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <code className="break-all min-w-0 flex-1">{command}</code>
      </div>

      {/* Aksiyon Butonları & Dolan Canlı İlerleme Çubuğu */}
      {status === "pending" ? (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            disabled={loading}
            onClick={handleApprove}
            className="min-h-[44px] py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{t("chat.approveBtn") || "Onayla ve Çalıştır"}</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleReject}
            className="min-h-[44px] py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-extrabold text-xs border border-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <XCircle className="w-4 h-4 text-rose-400" />
            <span>{t("chat.rejectBtn") || "Reddet"}</span>
          </button>
        </div>
      ) : status === "approved" || status === "running" ? (
        <div className="space-y-2.5 p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/40">
          <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
              <span>⚡ Mac Runner çalıştırıyor... Terminal dinleniyor</span>
            </span>
            <span className="text-[11px] font-mono text-cyan-400 font-extrabold">
              %{Math.min(progress, 95)} ({seconds}s)
            </span>
          </div>

          {/* Dolan İlerleme Çubuğu */}
          <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-blue-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(6,182,212,0.8)]"
              style={{ width: `${Math.min(progress, 95)}%` }}
            />
          </div>

          <p className="text-[10px] text-slate-400 text-center animate-pulse">
            Terminal çıktısı bittiğinde yapay zeka analiziyle birlikte tek seferde basılacak...
          </p>
        </div>
      ) : status === "completed" ? (
        <div className="space-y-2 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>✅ Komut Başarıyla Tamamlandı</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-black">%100</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full w-full" />
          </div>
        </div>
      ) : status === "failed" ? (
        <div className="space-y-2 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>⚠️ Komut Çalıştırıldı (İnceleme Aşağıda)</span>
            </span>
            <span className="text-[10px] font-mono text-amber-400 font-black">%100</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full w-full" />
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
          <XCircle className="w-4 h-4 text-slate-500" />
          <span>Bu işlem kullanıcı tarafından reddedildi.</span>
        </div>
      )}
    </div>
  );
}
