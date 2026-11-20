"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Paperclip,
  X,
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
  Copy,
  Check,
  Laptop,
  Shield,
  Wrench,
  Loader2,
  BookOpen,
} from "lucide-react";
import { ApprovalCard } from "./approval-card";
import { RunnerSetupModal } from "./runner-setup-modal";
import {
  LOCAL_CLI_MODELS,
  isLocalCliModel,
  type LocalCliMode,
  type ChatAttachment,
} from "@/lib/runner/local-cli";
import { useTranslation } from "@/lib/i18n/context";
import { toast } from "sonner";

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
  attachments?: ChatAttachment[];
  timestamp: Date;
  approval?: {
    id: string;
    command: string;
    description: string;
    riskLevel: "low" | "medium" | "high" | "critical";
    status: "pending" | "approved" | "rejected" | "running" | "completed" | "failed";
  };
}

interface ActiveLocalJob {
  id: string;
  description: string;
  status: string;
  startedAt: number;
}

interface ChatViewProps {
  initialProjects: Project[];
  runnerToken: string;
  isRunnerOnline: boolean;
  runnerDeviceName?: string;
  hasGeminiKey?: boolean;
}

export function ChatView({
  initialProjects,
  runnerToken,
  isRunnerOnline,
  runnerDeviceName = "",
  hasGeminiKey = false,
}: ChatViewProps) {
  const { t, locale } = useTranslation();
  const [projects] = useState<Project[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjects.find((p) => p.slug === "devstudio")?.id ||
    initialProjects.find((p) => p.isDefault)?.id ||
    initialProjects[0]?.id ||
    ""
  );

  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const [runnerOnline, setRunnerOnline] = useState<boolean>(isRunnerOnline);
  const [deviceName, setDeviceName] = useState<string>(runnerDeviceName);
  const [setupModalOpen, setSetupModalOpen] = useState<boolean>(false);

  const [selectedModel, setSelectedModel] = useState<string>(
    isRunnerOnline ? "local:agy:gemini-4-neon-high" : "gemini-3-flash-preview"
  );
  const [localMode, setLocalMode] = useState<LocalCliMode>("auto");
  const [activeLocalJob, setActiveLocalJob] = useState<ActiveLocalJob | null>(null);
  const [localJobSeconds, setLocalJobSeconds] = useState<number>(0);

  const [input, setInput] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t("chat.welcomeMsg"),
      timestamp: new Date(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending, activeLocalJob]);

  // Aktif Yerel CLI Ajan görevini canlı izle (10 dakikaya kadar sıfır timeout)
  useEffect(() => {
    if (!activeLocalJob) {
      setLocalJobSeconds(0);
      return;
    }

    const secTimer = setInterval(() => {
      setLocalJobSeconds(Math.max(1, Math.floor((Date.now() - activeLocalJob.startedAt) / 1000)));
    }, 1000);

    const pollTimer = setInterval(async () => {
      try {
        const resp = await fetch(
          `/api/chat?action=approval_status&approvalId=${activeLocalJob.id}&projectId=${selectedProjectId}`
        );
        if (!resp.ok) return;
        const statusRes = await resp.json();
        if (
          statusRes &&
          (statusRes.status === "completed" || statusRes.status === "failed") &&
          statusRes.analysis
        ) {
          clearInterval(pollTimer);
          clearInterval(secTimer);
          setActiveLocalJob(null);
          await loadProjectChat(selectedProjectId, activeSessionId);
          if (statusRes.status === "completed") {
            toast.success(t("chat.localJobDoneToast"));
          } else {
            toast.warning(t("chat.localJobWarnToast"));
          }
        }
      } catch (e) {
        console.error("Local CLI poller error:", e);
      }
    }, 2000);

    return () => {
      clearInterval(secTimer);
      clearInterval(pollTimer);
    };
  }, [activeLocalJob, selectedProjectId, activeSessionId]);

  // Bekleyen / Devam eden onayları otomatik dinle (Sayfa yenilense veya uzun sürse dahi)
  useEffect(() => {
    const activeAppr = messages.find(
      (m) => m.approval && (m.approval.status === "approved" || m.approval.status === "running")
    )?.approval;

    if (!activeAppr) return;

    const interval = setInterval(async () => {
      try {
        const resp = await fetch(
          `/api/chat?action=approval_status&approvalId=${activeAppr.id}&projectId=${selectedProjectId}`
        );
        if (!resp.ok) return;
        const statusRes = await resp.json();
        if (
          statusRes &&
          (statusRes.status === "completed" || statusRes.status === "failed") &&
          statusRes.analysis
        ) {
          clearInterval(interval);
          await loadProjectChat(selectedProjectId, activeSessionId);
          toast.success(t("chat.taskDoneToast"));
        }
      } catch (e) {
        console.error("Poller error:", e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [messages, selectedProjectId, activeSessionId]);

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
        if (data.runnerStatus) {
          setRunnerOnline(Boolean(data.runnerStatus.isOnline));
          if (data.runnerStatus.deviceName) {
            setDeviceName(data.runnerStatus.deviceName);
          }
        }
        if (data.activeLocalJob) {
          setActiveLocalJob({
            id: data.activeLocalJob.id,
            description: data.activeLocalJob.description,
            status: data.activeLocalJob.status,
            startedAt: data.activeLocalJob.createdAt
              ? new Date(data.activeLocalJob.createdAt).getTime()
              : Date.now(),
          });
        } else {
          setActiveLocalJob(null);
        }
        if (data.messages && data.messages.length > 0) {
          setMessages(
            data.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              attachments: Array.isArray(m.attachments) ? m.attachments : [],
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
              content:
                locale === "en"
                  ? `🚀 Connected to **${prj?.name || "Project"}** workspace.\n\nLocal path: \`${prj?.localPath}\`\n\nFeel free to ask questions, discuss architecture, or request code and terminal actions.`
                  : `🚀 **${prj?.name || "Proje"}** çalışma ortamına bağlandın.\n\nMac/PC dizini: \`${prj?.localPath}\`\n\nBu proje hakkında sormak istediğin soruları, mimari fikirleri veya dosya/terminal işlemlerini serbestçe yazabilirsin.`,
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
            content: `✨ **${prj?.name}** ${t("chat.newSessionWelcome")}`,
            timestamp: new Date(),
          },
        ]);
        toast.success(t("chat.newSessionOpenedToast"));
      }
    } catch (e: any) {
      toast.error(`${t("chat.sessionOpenErrorToast")}: ` + e.message);
    }
  };

  // Seçilen dosya / fotoğrafı temizle
  const clearSelectedFile = () => {
    if (selectedPreviewUrl) {
      URL.revokeObjectURL(selectedPreviewUrl);
    }
    setSelectedFile(null);
    setSelectedPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Dosya seçimi
  const handleFileSelect = (file: File | null) => {
    if (selectedPreviewUrl) {
      URL.revokeObjectURL(selectedPreviewUrl);
    }
    if (!file) {
      setSelectedFile(null);
      setSelectedPreviewUrl(null);
      return;
    }
    if (!file.type.startsWith("image/") && file.size > 2.5 * 1024 * 1024) {
      toast.error(t("chat.attachmentSizeError"));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      setSelectedPreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedPreviewUrl(null);
    }
  };

  // Görselleri mobil dostu boyuta sıkıştır, diğer dosyaları base64 dataUrl'a çevir
  const prepareAttachment = async (file: File): Promise<ChatAttachment> => {
    const readAsDataUrl = (blob: Blob): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Dosya okunamadı"));
        reader.readAsDataURL(blob);
      });

    if (file.type.startsWith("image/")) {
      try {
        const rawUrl = await readAsDataUrl(file);
        const compressed = await new Promise<string>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const maxDim = 1400;
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              const ratio = Math.min(maxDim / width, maxDim / height);
              width = Math.round(width * ratio);
              height = Math.round(height * ratio);
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(rawUrl);
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.82));
          };
          img.onerror = () => resolve(rawUrl);
          img.src = rawUrl;
        });

        const finalMime = compressed.startsWith("data:image/jpeg")
          ? "image/jpeg"
          : file.type || "image/png";
        return {
          name: file.name,
          mimeType: finalMime,
          size: file.size,
          dataUrl: compressed,
        };
      } catch {
        const fallbackUrl = await readAsDataUrl(file);
        return {
          name: file.name,
          mimeType: file.type || "image/png",
          size: file.size,
          dataUrl: fallbackUrl,
        };
      }
    }

    const dataUrl = await readAsDataUrl(file);
    return {
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      dataUrl,
    };
  };

  // Mesaj Gönder
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && !selectedFile) || isSending || activeLocalJob) return;

    const userText = input.trim();
    const fileToSend = selectedFile;
    setIsSending(true);

    let preparedAttachments: ChatAttachment[] = [];
    if (fileToSend) {
      try {
        const prepared = await prepareAttachment(fileToSend);
        preparedAttachments = [prepared];
      } catch (err: any) {
        toast.error(err?.message || t("chat.attachmentPrepareError"));
        setIsSending(false);
        return;
      }
    }

    const displayContent =
      userText || (preparedAttachments.length > 0 ? t("chat.attachmentFallbackMsg") : "");

    // Mesaj kutusunu ve seçili eki hemen temizle
    setInput("");
    clearSelectedFile();

    const tempId = "usr_" + Date.now();
    const tempUserMsg: Message = {
      id: tempId,
      role: "user",
      content: displayContent,
      attachments: preparedAttachments,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          sessionId: activeSessionId,
          model: selectedModel,
          localMode,
          content: displayContent,
          attachments: preparedAttachments,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 409 && errJson.code === "RUNNER_OFFLINE") {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          setInput(userText);
          if (fileToSend) handleFileSelect(fileToSend);
          setRunnerOnline(false);
          toast.error(errJson.error || "PC / Mac Runner çevrimdışı!");
          setSetupModalOpen(true);
          return;
        }
        throw new Error(errJson.error || "İstek başarısız oldu");
      }

      const data = await res.json();
      if (data.sessionId && data.sessionId !== activeSessionId) {
        setActiveSessionId(data.sessionId);
      }

      // Yerel CLI Ajan görevi kuyruğa alındı -> canlı izleme kartını başlat
      if (data.isLocalCliJob && data.localJob) {
        setActiveLocalJob({
          id: data.localJob.id,
          description: data.localJob.description,
          status: data.localJob.status,
          startedAt: Date.now(),
        });
        toast.info(t("chat.localJobQueuedToast"));
        return;
      }

      if (data.assistantMessage) {
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
      }
    } catch (err: any) {
      toast.error(`${t("chat.sendFailedToast")}: ` + err.message);
    } finally {
      setIsSending(false);
    }
  };

  // Onaylama & Sunucu Otonom Yürütme Döngüsü (Server-Side Atomic Pipeline)
  const handleApprove = async (approvalId: string) => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", approvalId }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Sunucu onayı kabul etmedi");
      }

      // SADECE sunucu isteği başarıyla kabul ettiğinde kartı "approved" yap
      setMessages((prev) =>
        prev.map((m) =>
          m.approval?.id === approvalId
            ? { ...m, approval: { ...m.approval, status: "approved" } }
            : m
        )
      );
      toast.info(t("chat.cmdSentToast"));

      // Runner ve Sunucu Otonom Analizini yokla (REST polling)
      const pollTimer = setInterval(async () => {
        try {
          const resp = await fetch(
            `/api/chat?action=approval_status&approvalId=${approvalId}&projectId=${selectedProjectId}`
          );
          if (!resp.ok) return;
          const statusRes = await resp.json();

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
            toast.success(t("chat.cmdCompletedToast"));
          }
        } catch (e) {
          console.error("Poller fetch error:", e);
        }
      }, 1500);

      setTimeout(() => clearInterval(pollTimer), 600000);
    } catch (err: any) {
      toast.error(`${t("chat.approveFailedToast")}: ` + err.message);
    }
  };

  const handleReject = async (approvalId: string) => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", approvalId }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Sunucu işlemi reddedemedi");
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.approval?.id === approvalId
            ? { ...m, approval: { ...m.approval, status: "rejected" } }
            : m
        )
      );
      toast.info(t("chat.cmdRejectedToast"));
    } catch (err: any) {
      toast.error(`${t("chat.rejectFailedToast")}: ` + err.message);
    }
  };

  const handleCopyMessage = async (msgId: string, content: string, isRunner: boolean) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) {
          throw new Error("Kopyalama desteklenmiyor");
        }
      }

      setCopiedMsgId(msgId);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedMsgId((prev) => (prev === msgId ? null : prev));
      }, 2000);
      toast.success(isRunner ? t("chat.copiedRunnerToast") : t("chat.copiedAiToast"));
    } catch {
      toast.error(t("chat.copyFailedToast"));
    }
  };

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const currentProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 relative w-full h-full">
      {/* Mobil Karartma Perdesi (Backdrop) */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-20 md:hidden cursor-pointer"
        />
      )}

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
            <h2 className="text-sm font-black text-white tracking-wide">{t("chat.myProjectsHeader")}</h2>
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
            {t("chat.activeWorkspace")}
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
              {t("chat.chatHistory")}
            </span>
            <button
              onClick={handleNewSession}
              className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> {t("chat.newChat")}
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
              <p className="text-[11px] text-slate-500 px-2 italic">{t("chat.noHistory")}</p>
            )}
          </div>
        </div>

        {/* Runner Durum Çubuğu */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                runnerOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span className="text-[11px] font-bold text-slate-300 truncate" title={deviceName}>
              {runnerOnline ? t("chat.runnerOnlineShort") : t("chat.runnerOfflineShort")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSetupModalOpen(true)}
            className="min-h-[36px] px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-[11px] font-bold text-cyan-300 hover:bg-cyan-500/25 inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t("chat.setupShort")}</span>
          </button>
        </div>
      </div>

      {/* SAĞ ANA SOHBET ALANI */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-950 min-h-0">
        {/* Üst Kokpit Barı */}
        <div className="shrink-0 px-3 py-2 sm:p-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-3 w-full max-w-full overflow-hidden">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Sidebar Aç / Kapa Butonu (Kural 8: Dokunmatik Hedef & Asla Ezilmeyen Z-Index) */}
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center transition-all cursor-pointer z-10"
              title={t("chat.projectsMenu")}
              aria-label={t("chat.projectsMenu")}
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4 text-cyan-400" /> : <PanelLeftOpen className="w-4 h-4 text-slate-300" />}
            </button>

            {/* Aktif Proje Künyesi */}
            <div className="min-w-0 truncate">
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <span className="text-xs font-black text-white truncate">
                  {currentProject?.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-cyan-300 font-mono shrink-0 hidden xs:inline-block">
                  {currentProject?.slug}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono truncate hidden sm:block">
                {currentProject?.localPath}
              </p>
            </div>
          </div>

          {/* Model Seçici & Kurulum Rehberi İkonu */}
          <div className="flex items-center gap-1.5 shrink-0 min-w-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs max-w-[148px] xs:max-w-[180px] sm:max-w-[260px] min-w-0 min-h-[44px]">
              <Cpu className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                aria-label={t("chat.selectAiModel")}
                className="bg-transparent text-[11px] sm:text-xs font-bold text-slate-200 focus:outline-none cursor-pointer pr-1 w-full truncate"
              >
                <optgroup label={t("chat.localModelsGroup")} className="bg-slate-900 text-cyan-300">
                  {LOCAL_CLI_MODELS.map((m) => (
                    <option key={m.value} value={m.value} className="bg-slate-900 text-white">
                      {m.shortLabel}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t("chat.cloudModelsGroup")} className="bg-slate-900 text-purple-300">
                  <option value="gemini-3-flash-preview" className="bg-slate-900 text-white">
                    🚀 3-Flash ({t("chat.cloudTag")})
                  </option>
                  <option value="gemini-3.8-flash" className="bg-slate-900 text-white">
                    🌟 3.8 Flash ({t("chat.cloudTag")})
                  </option>
                  <option value="gemini-flash-lite-latest" className="bg-slate-900 text-white">
                    ⚡ Flash Lite ({t("chat.fastTag")})
                  </option>
                  <option value="gemini-3.5-flash-lite" className="bg-slate-900 text-white">
                    🧠 3.5 Flash Lite
                  </option>
                </optgroup>
              </select>
            </div>

            {/* PC / Mac Runner Kurulum Rehberi İkonu (44px Mobil Hedef) */}
            <button
              type="button"
              onClick={() => setSetupModalOpen(true)}
              title={t("chat.setupGuideTitle")}
              aria-label={t("chat.setupGuideTitle")}
              className="relative min-w-[44px] min-h-[44px] rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 flex items-center justify-center shrink-0 transition-all cursor-pointer"
            >
              <Laptop className="w-4 h-4" />
              <span
                className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-slate-900 ${
                  runnerOnline ? "bg-emerald-400" : "bg-rose-500"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Yerel Ajan Çalışma Modu Şeridi (Varsayılan Geliştir • Solda Opsiyonel Plan Kilidi) */}
        {isLocalCliModel(selectedModel) && (
          <div className="shrink-0 px-3 py-1.5 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between gap-2 w-full max-w-full overflow-hidden">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setLocalMode((prev) => (prev === "plan" ? "auto" : "plan"))}
                title={
                  localMode === "plan" ? t("chat.planTitleOn") : t("chat.planTitleOff")
                }
                className={`min-h-[44px] px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-extrabold inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  localMode === "plan"
                    ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 shadow-sm shadow-cyan-500/20"
                    : "bg-slate-950/70 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30"
                }`}
              >
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>{localMode === "plan" ? t("chat.planActiveBtn") : t("chat.planBtn")}</span>
              </button>

              {localMode === "auto" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400/90 truncate">
                  <Wrench className="w-3 h-3 shrink-0" />
                  <span className="truncate">{t("chat.developMode")}</span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSetupModalOpen(true)}
              className="min-h-[44px] px-2.5 rounded-xl text-[11px] font-bold text-slate-400 hover:text-cyan-300 inline-flex items-center gap-1.5 truncate cursor-pointer min-w-0"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  runnerOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
                }`}
              />
              <span className="truncate">
                {runnerOnline ? t("chat.pcMacReady") : t("chat.setupGuideLabel")}
              </span>
            </button>
          </div>
        )}

        {/* Mesaj Akışı (Sıfır Yatay Kaydırma) */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-3 sm:p-6 space-y-4 overscroll-contain w-full max-w-full">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const isRunner = msg.role === "runner";

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 sm:gap-3 max-w-3xl w-full min-w-0 ${
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

                <div className="space-y-2 w-full max-w-2xl min-w-0">
                  <div
                    className={`p-3.5 sm:p-4 rounded-3xl text-sm leading-relaxed shadow-lg break-words [overflow-wrap:anywhere] max-w-full overflow-hidden ${
                      isUser
                        ? "bg-cyan-600 text-white rounded-tr-sm"
                        : isRunner
                        ? "bg-slate-900/95 border border-emerald-500/30 text-emerald-300 font-mono text-xs rounded-tl-sm whitespace-pre-wrap break-all"
                        : "bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-sm whitespace-pre-wrap"
                    }`}
                  >
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-2.5 space-y-2 max-w-full">
                        {msg.attachments.map((att, idx) =>
                          att.mimeType?.startsWith("image/") && att.dataUrl ? (
                            <div key={`${msg.id}_att_${idx}`} className="space-y-1 max-w-full">
                              <img
                                src={att.dataUrl}
                                alt={att.name || "Ekli görsel"}
                                className="max-w-full max-h-64 rounded-2xl border border-white/20 bg-slate-950/40 object-contain"
                              />
                              <p className="text-[11px] opacity-80 truncate">{att.name}</p>
                            </div>
                          ) : (
                            <div
                              key={`${msg.id}_att_${idx}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950/35 border border-white/15 text-xs max-w-full"
                            >
                              <Paperclip className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{att.name}</span>
                            </div>
                          )
                        )}
                      </div>
                    )}
                    {msg.content}
                  </div>

                  {!isUser && (
                    <div className="flex items-center gap-2 max-w-full overflow-hidden">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.content, isRunner)}
                        aria-label={isRunner ? t("chat.copyRunnerAria") : t("chat.copyAiAria")}
                        className={`min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                          copiedMsgId === msg.id
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                            : "bg-slate-900/80 border-slate-800/90 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 active:scale-95"
                        }`}
                      >
                        {copiedMsgId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{t("chat.copied")}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 shrink-0" />
                            <span>{t("chat.copy")}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

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
            <div className="flex items-center gap-2.5 text-xs text-cyan-400 italic py-2 px-3 sm:px-4 rounded-2xl bg-cyan-950/20 border border-cyan-800/30 w-fit max-w-full">
              <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="truncate">{t("chat.sending")}</span>
            </div>
          )}

          {activeLocalJob && (
            <div className="max-w-2xl w-full rounded-3xl bg-slate-900/95 border-2 border-cyan-500/40 p-4 shadow-xl space-y-2.5 overflow-hidden">
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-cyan-300">
                <span className="flex items-center gap-2 min-w-0">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                  <span className="truncate">{activeLocalJob.description}</span>
                </span>
                <span className="text-[11px] font-mono text-cyan-400 font-black shrink-0">
                  {localJobSeconds}s
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden p-0.5 border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(92, 18 + localJobSeconds * 2)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {t("chat.localJobRunningNote")}
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Mesaj Giriş Barı (Mobile-First) */}
        <div className="shrink-0 p-2.5 sm:p-4 border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-md flex flex-col gap-2 w-full max-w-full overflow-hidden">
          {selectedFile && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-300 w-fit max-w-full">
              {selectedPreviewUrl ? (
                <img
                  src={selectedPreviewUrl}
                  alt={selectedFile.name}
                  className="w-8 h-8 rounded-lg object-cover border border-cyan-500/40 shrink-0"
                />
              ) : (
                <Paperclip className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
              )}
              <span className="truncate font-medium max-w-[190px] sm:max-w-xs">{selectedFile.name}</span>
              <button
                type="button"
                onClick={clearSelectedFile}
                aria-label={t("chat.removeAttachment")}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-cyan-900/50 rounded-lg text-cyan-400 hover:text-white transition-all ml-1 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <form onSubmit={handleSend} className="flex items-center gap-2 w-full min-w-0">
            <input
              ref={fileInputRef}
              type="file"
              id="file-attachment"
              accept="image/*,.pdf,.txt,.md,.json,.csv,.log"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 sm:p-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
              title={t("chat.attachFile")}
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isLocalCliModel(selectedModel)
                  ? `${currentProject?.name || ""} ${
                      localMode === "auto"
                        ? t("chat.placeholderLocalDevelop")
                        : t("chat.placeholderLocalPlan")
                    }`.trim()
                  : `${currentProject?.name || ""} ${t("chat.placeholderCloud")}`.trim()
              }
              disabled={isSending || Boolean(activeLocalJob)}
              className="flex-1 min-w-0 bg-slate-900/90 border border-slate-800 focus:border-cyan-500/80 rounded-2xl px-3.5 sm:px-4 py-3 sm:py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={isSending || Boolean(activeLocalJob) || (!input.trim() && !selectedFile)}
              className="px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer shrink-0 min-w-[44px] min-h-[44px]"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* macOS & Windows Runner Kurulum Rehberi Modalı */}
      <RunnerSetupModal
        open={setupModalOpen}
        onClose={() => setSetupModalOpen(false)}
        runnerToken={runnerToken}
        initialOnline={runnerOnline}
        initialDeviceName={deviceName}
        projectCount={projects.length}
        hasGeminiKey={hasGeminiKey}
        onStatusChange={(online, dev) => {
          setRunnerOnline(online);
          if (dev) setDeviceName(dev);
        }}
      />
    </div>
  );
}
