"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Paperclip,
  FolderGit2,
  Cpu,
  Terminal,
  Bot,
  User,
  Radio,
  Check,
} from "lucide-react";
import { ApprovalCard } from "./approval-card";
import { useTranslation } from "@/lib/i18n/context";
import { toast } from "sonner";
import {
  sendMessageAction,
  approveApprovalAction,
  rejectApprovalAction,
  getApprovalStatusAction,
} from "@/lib/actions/chat";

interface Project {
  id: string;
  name: string;
  slug: string;
  localPath: string;
  repoUrl?: string | null;
  deployCommand?: string | null;
  isDefault: boolean;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "runner";
  content: string;
  timestamp: Date;
  approval?: {
    id: string;
    command: string;
    description: string;
    riskLevel: "low" | "medium" | "high" | "critical";
    status: "pending" | "approved" | "rejected" | "running" | "completed" | "failed";
  };
}

interface ChatViewProps {
  initialProjects: Project[];
  runnerToken: string;
  isRunnerOnline: boolean;
}

export function ChatView({
  initialProjects,
  runnerToken,
  isRunnerOnline,
}: ChatViewProps) {
  const { t } = useTranslation();
  const [projects] = useState<Project[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjects.find((p) => p.slug === "devstudio")?.id ||
    initialProjects.find((p) => p.isDefault)?.id ||
    initialProjects[0]?.id ||
    ""
  );
  const [selectedModel, setSelectedModel] = useState<string>("gemini-flash-latest");
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "👋 Merhaba Erhan! DevStudio mobil yapay zeka mühendisine hoş geldin. AllTripX, BurstaBugun veya DevStudio projen üzerinde çalıştırmak istediğin komutları yazabilir, analiz isteyebilirsin. Mac'indeki yerel Runner komutları canlı çalıştırmak için hazır!",
      timestamp: new Date(),
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isSending) return;

    const userText = input.trim();
    setInput("");

    // Kullanıcı mesajını ekle
    const userMsg: Message = {
      id: "user_" + Date.now(),
      role: "user",
      content: userText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      const res = await sendMessageAction({
        projectId: selectedProjectId,
        model: selectedModel,
        content: userText,
      });

      const assistantMsg: Message = {
        id: res.assistantMessage.id,
        role: "assistant",
        content: res.assistantMessage.content,
        timestamp: new Date(res.assistantMessage.createdAt),
        approval: res.approval
          ? {
              id: res.approval.id,
              command: res.approval.command,
              description: res.approval.description,
              riskLevel: res.approval.riskLevel,
              status: res.approval.status,
            }
          : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      toast.error("Mesaj gönderilemedi: " + (err?.message || "Bilinmeyen hata"));
    } finally {
      setIsSending(false);
    }
  };

  const handleApprove = async (approvalId: string) => {
    toast.success("İşlem onaylandı! Mac Runner komutu devralıyor...");

    // UI durumunu approved yap
    setMessages((prev) =>
      prev.map((m) =>
        m.approval?.id === approvalId
          ? { ...m, approval: { ...m.approval, status: "approved" } }
          : m
      )
    );

    try {
      await approveApprovalAction(approvalId);

      // Runner çıktısını yokla (Polling)
      const pollTimer = setInterval(async () => {
        const statusRes = await getApprovalStatusAction(approvalId);
        if (statusRes && (statusRes.status === "completed" || statusRes.status === "failed")) {
          clearInterval(pollTimer);

          // Approval kartını tamamlandı yap
          setMessages((prev) =>
            prev.map((m) =>
              m.approval?.id === approvalId
                ? { ...m, approval: { ...m.approval, status: statusRes.status as any } }
                : m
            )
          );

          // Terminal çıktısını chat akışına ekle
          setMessages((prev) => [
            ...prev,
            {
              id: "runner_" + Date.now(),
              role: "runner",
              content: `⚡ **Runner Çıktısı (MacBook):**\n\`\`\`bash\n${statusRes.output || "(Boş çıktı)"}\n\`\`\`\n*Durum: ${statusRes.exitCode === 0 ? "✅ Başarılı (0)" : "❌ Hata (" + statusRes.exitCode + ")" }*`,
              timestamp: new Date(),
            },
          ]);

          if (statusRes.exitCode === 0) {
            toast.success("Komut başarıyla tamamlandı!");
          } else {
            toast.error("Komut hata ile sonlandı!");
          }
        }
      }, 1500);

      // Maksimum 2 dakika bekle
      setTimeout(() => clearInterval(pollTimer), 120000);
    } catch (err: any) {
      toast.error("Onay iletilemedi: " + err.message);
    }
  };

  const handleReject = async (approvalId: string) => {
    toast.info("İşlem reddedildi.");
    setMessages((prev) =>
      prev.map((m) =>
        m.approval?.id === approvalId
          ? { ...m, approval: { ...m.approval, status: "rejected" } }
          : m
      )
    );
    await rejectApprovalAction(approvalId).catch(() => {});
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto w-full">
      {/* Üst Seçici Bar (Proje & Model & Runner Durumu) */}
      <div className="p-3 sm:p-4 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Proje Seçici */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900 border border-slate-800">
            <FolderGit2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent text-xs font-extrabold text-white focus:outline-none cursor-pointer pr-2"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  📁 {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model Seçici */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900 border border-slate-800">
            <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent text-xs font-extrabold text-slate-300 focus:outline-none cursor-pointer pr-2"
            >
              <option value="gemini-flash-latest" className="bg-slate-900 text-white">
                ⚡ Gemini Flash (Hızlı & Ücretsiz)
              </option>
              <option value="gemini-3.8-flash" className="bg-slate-900 text-white">
                🧠 Gemini 3.8 Flash
              </option>
              <option value="gemma-4-26b-a4b-it" className="bg-slate-900 text-white">
                💎 Gemma 4 Open AI
              </option>
              <option value="claude-3-7-sonnet" className="bg-slate-900 text-white">
                🎭 Claude 3.7 Sonnet
              </option>
              <option value="gpt-4o" className="bg-slate-900 text-white">
                🟢 GPT-4o
              </option>
            </select>
          </div>
        </div>

        {/* Runner Komutu Hızlı Kopyalama Butonu */}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(`node devstudio-runner.mjs --token=${runnerToken}`);
            toast.success("Runner komutu kopyalandı! Mac veya Windows terminalinize yapıştırın.");
          }}
          className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Runner Komutunu Kopyala</span>
          <span className="sm:hidden">Runner</span>
        </button>
      </div>

      {/* Mesaj Akış Alanı */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const isRunner = msg.role === "runner";

          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${
                isUser ? "ml-auto flex-row-reverse" : "mr-auto"
              }`}
            >
              {/* Avatar İkonu */}
              <div
                className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 text-xs font-bold shadow-md ${
                  isUser
                    ? "bg-gradient-to-tr from-cyan-500 to-blue-600 text-slate-950 font-black"
                    : isRunner
                    ? "bg-slate-800 border border-emerald-500/50 text-emerald-400"
                    : "bg-slate-800 border border-cyan-500/40 text-cyan-400"
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : isRunner ? <Terminal className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Mesaj Gövdesi */}
              <div className="space-y-2 w-full">
                <div
                  className={`p-4 rounded-3xl text-sm leading-relaxed shadow-lg ${
                    isUser
                      ? "bg-cyan-600 text-white rounded-tr-sm"
                      : isRunner
                      ? "bg-slate-900/95 border border-emerald-500/30 text-emerald-300 font-mono text-xs rounded-tl-sm whitespace-pre-wrap"
                      : "bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-sm whitespace-pre-wrap"
                  }`}
                >
                  {msg.content}
                </div>

                {/* İnteraktif Onay Kartı Varsa Render Et */}
                {msg.approval && (
                  <ApprovalCard
                    id={msg.approval.id}
                    command={msg.approval.command}
                    description={msg.approval.description}
                    riskLevel={msg.approval.riskLevel}
                    status={msg.approval.status}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                )}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex items-center gap-2 text-xs text-slate-400 italic py-2">
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span>DevStudio yapay zeka mühendisi analiz ediyor...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Alt Hızlı İpuçları & Mesaj Giriş Alanı (Mobile-First) */}
      <div className="p-3 sm:p-4 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-md space-y-2">
        {/* Hızlı Komut Hapları */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
          <button
            type="button"
            onClick={() => setInput("git status kontrol et")}
            className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white shrink-0 cursor-pointer"
          >
            🔍 Git Status
          </button>
          <button
            type="button"
            onClick={() => setInput("Projede son durumu kontrol et ve testleri çalıştır")}
            className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white shrink-0 cursor-pointer"
          >
            🧪 Testleri Koş
          </button>
          <button
            type="button"
            onClick={() => setInput("GitHub'daki son commit geçmişini incele")}
            className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white shrink-0 cursor-pointer"
          >
            📜 Git Geçmişi
          </button>
          <button
            type="button"
            onClick={() => setInput("Canlıya dağıtım yap ve test linkini ver")}
            className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white shrink-0 cursor-pointer"
          >
            🚀 Canlıya Deploy Et
          </button>
        </div>

        {/* Giriş Formu */}
        <form onSubmit={handleSend} className="flex items-center gap-2">
          {/* Ek Ekle Butonu */}
          <button
            type="button"
            onClick={() => toast.info("Ekran görüntüsü yükleme penceresi açılıyor...")}
            className="w-11 h-11 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white shrink-0 transition-all cursor-pointer"
            title={t("chat.attachFile") || "Dosya Ekle"}
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Metin Giriş Alanı */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("chat.placeholder") || "Talimatınızı yazın (Örn: git status kontrol et)..."}
              className="w-full h-11 px-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 transition-all"
            />
          </div>

          {/* Gönder Butonu */}
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group"
          >
            <Send className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </form>
      </div>
    </div>
  );
}
