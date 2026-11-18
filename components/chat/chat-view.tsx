"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Terminal,
  Cpu,
  FolderGit2,
  CheckCircle2,
  AlertCircle,
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  Bot,
  User,
  Sparkles,
} from "lucide-react";
import { ApprovalCard } from "./approval-card";
import { useTranslation } from "@/lib/i18n/context";
import { toast } from "sonner";
import { approveApprovalAction, rejectApprovalAction, getApprovalStatusAction } from "@/lib/actions/chat";

interface Project {
  id: string;
  name: string;
  slug: string;
  localPath: string;
  repoUrl?: string | null;
  deployCommand?: string | null;
  isDefault: boolean;
}

interface ChatSessionItem {
  id: string;
  title: string;
  updatedAt: string;
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

  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.5-flash-lite");
  const [input, setInput] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "👋 Merhaba Erhan! DevStudio mobil yapay zeka mühendisine hoş geldin. Sol panelden çalışmak istediğin projeyi ve oturumu seçebilir, dilediğin gibi serbestçe sohbet edebilirsin. Mac'indeki yerel Runner komutları canlı çalıştırmak için hazır!",
      timestamp: new Date(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Proje veya oturum değiştiğinde mesajları yükle
  const loadProjectChat = async (projId: string, sessId?: string) => {
    try {
      let url = `/api/chat?projectId=${projId}`;
      if (sessId) url += `&sessionId=${sessId}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        if (data.activeSession) {
          setActiveSessionId(data.activeSession.id);
        }
        if (data.messages && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: new Date(m.timestamp),
              approval: m.approval || undefined,
            }))
          );
        } else {
          const prj = projects.find((p) => p.id === projId);
          setMessages([
            {
              id: "welcome_" + projId,
              role: "assistant",
              content: `🚀 **${prj?.name || "Proje"}** çalışma ortamına bağlandın.\n\nMac dizini: \`${prj?.localPath}\`\n\nBu proje hakkında sormak istediğin soruları, mimari fikirleri veya dosya/terminal işlemlerini serbestçe yazabilirsin.`,
              timestamp: new Date(),
            },
          ]);
        }
      }
    } catch (e) {
      console.error("Chat yükleme hatası:", e);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectChat(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Yeni Sohbet Başlat
  const handleNewSession = async () => {
    try {
      const res = await fetch(`/api/chat?action=new_session&projectId=${selectedProjectId}`);
      if (res.ok) {
        const data = await res.json();
        const prj = projects.find((p) => p.id === selectedProjectId);
        setActiveSessionId(data.session.id);
        setSessions((prev) => [data.session, ...prev]);
        setMessages([
          {
            id: "new_welcome",
            role: "assistant",
            content: `✨ **${prj?.name}** için yeni ve temiz bir sohbet oturumu başlatıldı! Ne üzerinde çalışmak istersin?`,
            timestamp: new Date(),
          },
        ]);
        toast.success("Yeni sohbet oturumu açıldı");
      }
    } catch (e: any) {
      toast.error("Oturum açılamadı: " + e.message);
    }
  };

  // Mesaj Gönder
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isSending) return;

    const userText = input.trim();
    setInput("");

    const tempUserMsg: Message = {
      id: "usr_" + Date.now(),
      role: "user",
      content: userText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          sessionId: activeSessionId,
          model: selectedModel,
          content: userText,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "İstek başarısız oldu");
      }

      const data = await res.json();
      if (data.sessionId && data.sessionId !== activeSessionId) {
        setActiveSessionId(data.sessionId);
      }

      const assistantMsg: Message = {
        id: data.assistantMessage.id,
        role: "assistant",
        content: data.assistantMessage.content,
        timestamp: new Date(data.assistantMessage.createdAt),
        approval: data.approval
          ? {
              id: data.approval.id,
              command: data.approval.command,
              description: data.approval.description,
              riskLevel: data.approval.riskLevel,
              status: data.approval.status,
            }
          : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      toast.error("Mesaj iletilemedi: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  // Onaylama & Sunucu Otonom Yürütme Döngüsü (Server-Side Atomic Pipeline)
  const handleApprove = async (approvalId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.approval?.id === approvalId
          ? { ...m, approval: { ...m.approval, status: "approved" } }
          : m
      )
    );

    try {
      await approveApprovalAction(approvalId);
      toast.info("Komut Mac Runner'a iletildi, çubuk çalışıyor...");

      // Runner ve Sunucu Otonom Analizini yokla
      const pollTimer = setInterval(async () => {
        const statusRes = await getApprovalStatusAction(approvalId);

        // Sunucu analizi bitirdiğinde (status completed veya failed VE analysis doluysa)
        if (
          statusRes &&
          (statusRes.status === "completed" || statusRes.status === "failed") &&
          statusRes.analysis
        ) {
          clearInterval(pollTimer);

          // 1. Approval kartını tamamlandı yap (çubuk %100 olur)
          setMessages((prev) =>
            prev.map((m) =>
              m.approval?.id === approvalId
                ? { ...m, approval: { ...m.approval, status: statusRes.status as any } }
                : m
            )
          );

          // 2. Projenin güncel sohbet geçmişini tek seferde sunucudan çekip ekrana koy!
          await loadProjectChat(selectedProjectId, activeSessionId);
          toast.success("Komut ve analiz tek seferde tamamlandı!");
        }
      }, 1500);

      setTimeout(() => clearInterval(pollTimer), 120000);
    } catch (err: any) {
      toast.error("Onay iletilemedi: " + err.message);
    }
  };

  const handleReject = async (approvalId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.approval?.id === approvalId
          ? { ...m, approval: { ...m.approval, status: "rejected" } }
          : m
      )
    );
    try {
      await rejectApprovalAction(approvalId);
      toast.info("İşlem reddedildi.");
    } catch (err: any) {
      toast.error("Reddedilemedi: " + err.message);
    }
  };

  const currentProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="flex-1 flex overflow-hidden relative">
      {/* SOL KENAR ÇUBUĞU (Projeler & Sohbet Geçmişi) */}
      <div
        className={`${
          sidebarOpen ? "translate-x-0 w-72" : "-translate-x-full w-0"
        } transition-all duration-300 ease-in-out border-r border-slate-800/80 bg-slate-950/95 backdrop-blur-xl flex flex-col shrink-0 z-30 absolute md:static h-full shadow-2xl md:shadow-none overflow-hidden`}
      >
        {/* Sidebar Üst Başlık & Kapat Butonu */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-black text-white tracking-wide">PROJELERİM</h2>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white md:hidden"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        </div>

        {/* Proje Sekmeleri */}
        <div className="p-3 space-y-2 border-b border-slate-800/80">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">
            Aktif Çalışma Alanı
          </span>
          <div className="space-y-1">
            {projects.map((p) => {
              const isSelected = p.id === selectedProjectId;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProjectId(p.id);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-2xl transition-all flex items-center justify-between text-xs font-bold ${
                    isSelected
                      ? "bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 shadow-md shadow-cyan-950/30"
                      : "bg-slate-900/60 border border-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-base">{p.slug === "devstudio" ? "🚀" : p.slug === "bursta-bugun" ? "🏛️" : "🌴"}</span>
                    <span className="truncate">{p.name}</span>
                  </div>
                  {isSelected && <ChevronRight className="w-4 h-4 text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Projenin Sohbet Geçmişi */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Sohbet Geçmişi
            </span>
            <button
              onClick={handleNewSession}
              className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Yeni
            </button>
          </div>

          <div className="space-y-1">
            {sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              return (
                <button
                  key={sess.id}
                  onClick={() => {
                    setActiveSessionId(sess.id);
                    loadProjectChat(selectedProjectId, sess.id);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center gap-2 truncate ${
                    isActive
                      ? "bg-slate-800 text-white font-bold border border-slate-700"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/80"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{sess.title}</span>
                </button>
              );
            })}

            {sessions.length === 0 && (
              <p className="text-[11px] text-slate-500 px-2 italic">Henüz geçmiş sohbet yok</p>
            )}
          </div>
        </div>

        {/* Runner Durum Çubuğu */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isRunnerOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span className="text-[11px] font-bold text-slate-300">
              {isRunnerOnline ? "Mac Online" : "Mac Çevrimdışı"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(`node devstudio-runner.mjs --token=${runnerToken}`);
              toast.success("Runner komutu kopyalandı!");
            }}
            className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
          >
            Kodu Kopyala
          </button>
        </div>
      </div>

      {/* SAĞ ANA SOHBET ALANI */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {/* Üst Kokpit Barı */}
        <div className="p-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {/* Sidebar Aç / Kapa Butonu */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white"
              title="Projeler Menüsü"
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>

            {/* Aktif Proje Künyesi */}
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white truncate">
                  {currentProject?.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-cyan-300 font-mono">
                  {currentProject?.slug}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono truncate hidden sm:block">
                {currentProject?.localPath}
              </p>
            </div>
          </div>

          {/* Model Seçici */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
              <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer pr-1"
              >
                <option value="gemini-3.5-flash-lite" className="bg-slate-900 text-white">
                  ⚡ Gemini 3.5 Flash Lite (Hızlı & Kesintisiz)
                </option>
                <option value="gemini-3.1-flash-lite" className="bg-slate-900 text-white">
                  🧠 Gemini 3.1 Flash Lite
                </option>
                <option value="gemini-3.5-flash" className="bg-slate-900 text-white">
                  🚀 Gemini 3.5 Flash
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Mesaj Akışı */}
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

                <div className="space-y-2 w-full max-w-2xl">
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
            <div className="flex items-center gap-2.5 text-xs text-cyan-400 italic py-2 px-4 rounded-2xl bg-cyan-950/20 border border-cyan-800/30 w-fit">
              <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span>DevStudio çıktıyı analiz ediyor ve yönlendirme hazırlıyor...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Mesaj Giriş Barı (Mobile-First) */}
        <div className="p-3 sm:p-4 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`${currentProject?.name} için serbestçe yaz...`}
              disabled={isSending}
              className="flex-1 bg-slate-900/90 border border-slate-800 focus:border-cyan-500/80 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
