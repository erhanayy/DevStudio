"use client";

import { useState } from "react";
import { ShieldAlert, CheckCircle2, XCircle, Terminal, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";

interface ApprovalCardProps {
  id: string;
  command: string;
  description: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected";
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

  const riskColors = {
    low: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    medium: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    high: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    critical: "text-rose-400 bg-rose-500/10 border-rose-500/30 animate-pulse",
  };

  return (
    <div className="rounded-3xl bg-slate-900 border-2 border-amber-500/40 p-4 sm:p-5 shadow-2xl space-y-3.5 my-3 animate-in fade-in zoom-in-95 duration-200">
      {/* Üst Başlık & Risk Seviyesi */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5">
              <span>İşlem Onayı Gerekiyor</span>
            </h4>
            <p className="text-[11px] text-slate-400">{description}</p>
          </div>
        </div>

        <span
          className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${riskColors[riskLevel]}`}
        >
          {riskLevel}
        </span>
      </div>

      {/* Komut Kutusu */}
      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-amber-300 break-all select-all flex items-start gap-2">
        <Terminal className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <code>{command}</code>
      </div>

      {/* Aksiyon Butonları (Mobilde Parmakla Dokunmaya Uygun Min 44px) */}
      {status === "pending" ? (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            disabled={loading}
            onClick={handleApprove}
            className="min-h-[44px] py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{t("chat.approveBtn")}</span>
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
            <span>{t("chat.rejectBtn")}</span>
          </button>
        </div>
      ) : status === "approved" ? (
        <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Bu komut onaylandı ve çalıştırılıyor...</span>
        </div>
      ) : (
        <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center justify-center gap-2">
          <XCircle className="w-4 h-4" />
          <span>Bu işlem kullanıcı tarafından reddedildi.</span>
        </div>
      )}
    </div>
  );
}
