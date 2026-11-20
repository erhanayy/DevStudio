export const LOCAL_CLI_PREFIX = "__LOCAL_CLI__::";
export const LOCAL_APPROVAL_START = "<<<DEVSTUDIO_APPROVAL>>>";
export const LOCAL_APPROVAL_END = "<<<END_DEVSTUDIO_APPROVAL>>>";

export type LocalCliEngine = "agy" | "claude" | "gemini";
export type LocalCliMode = "plan" | "auto";

export interface LocalCliApprovalRequest {
  command: string;
  description: string;
  riskLevel: "low" | "medium" | "high" | "critical";
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export interface LocalCliPayload {
  engine: LocalCliEngine;
  model: string;
  mode: LocalCliMode;
  prompt: string;
  sessionId: string;
  attachments?: ChatAttachment[];
}

export interface LocalModelOption {
  value: string;
  label: string;
  shortLabel: string;
  engine: LocalCliEngine;
  modelId: string;
}

export const LOCAL_CLI_MODELS: LocalModelOption[] = [
  {
    value: "local:agy:gemini-4-neon-high",
    label: "🖥️ Yerel Ajan • Gemini 4 Neon (High)",
    shortLabel: "🖥️ 4 Neon (CLI)",
    engine: "agy",
    modelId: "gemini-4-neon-high",
  },
  {
    value: "local:agy:claude-sonnet-5-5-high",
    label: "🖥️ Yerel Ajan • Claude Sonnet 5.5",
    shortLabel: "🖥️ Sonnet 5.5 (CLI)",
    engine: "agy",
    modelId: "claude-sonnet-5-5-high",
  },
  {
    value: "local:agy:claude-opus-5-5-high",
    label: "🖥️ Yerel Ajan • Claude Opus 5.5",
    shortLabel: "🖥️ Opus 5.5 (CLI)",
    engine: "agy",
    modelId: "claude-opus-5-5-high",
  },
  {
    value: "local:agy:gemini-4-hydrogen-high",
    label: "🖥️ Yerel Ajan • Gemini 4 Hydrogen",
    shortLabel: "🖥️ 4 Hydrogen (CLI)",
    engine: "agy",
    modelId: "gemini-4-hydrogen-high",
  },
  {
    value: "local:agy:gemini-3.8-flash-high",
    label: "🖥️ Yerel Ajan • Gemini 3.8 Flash",
    shortLabel: "🖥️ 3.8 Flash (CLI)",
    engine: "agy",
    modelId: "gemini-3.8-flash-high",
  },
  {
    value: "local:claude:default",
    label: "🖥️ Yerel Ajan • Claude Code CLI",
    shortLabel: "🖥️ Claude CLI",
    engine: "claude",
    modelId: "default",
  },
  {
    value: "local:gemini:default",
    label: "🖥️ Yerel Ajan • Gemini CLI",
    shortLabel: "🖥️ Gemini CLI",
    engine: "gemini",
    modelId: "default",
  },
];

export function isLocalCliModel(model?: string | null): boolean {
  return typeof model === "string" && model.startsWith("local:");
}

export function parseLocalCliModel(
  model: string
): { engine: LocalCliEngine; modelId: string; displayName: string } | null {
  if (!isLocalCliModel(model)) return null;
  const parts = model.split(":");
  if (parts.length < 3) return null;
  const engine = parts[1] as LocalCliEngine;
  if (engine !== "agy" && engine !== "claude" && engine !== "gemini") return null;
  const modelId = parts.slice(2).join(":");
  const found = LOCAL_CLI_MODELS.find((m) => m.value === model);
  return {
    engine,
    modelId,
    displayName: found?.shortLabel || `${engine} (${modelId})`,
  };
}

export function encodeLocalCliCommand(payload: LocalCliPayload): string {
  return `${LOCAL_CLI_PREFIX}${JSON.stringify(payload)}`;
}

export function isLocalCliCommand(command?: string | null): boolean {
  return typeof command === "string" && command.startsWith(LOCAL_CLI_PREFIX);
}

export function parseLocalCliCommand(command: string): LocalCliPayload | null {
  if (!isLocalCliCommand(command)) return null;
  try {
    const raw = command.slice(LOCAL_CLI_PREFIX.length);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as LocalCliPayload;
  } catch {
    return null;
  }
}

const SENSITIVE_ACTION_CMD_REGEX =
  /\b(git\s+(?:add|commit|push|tag)\b|gcloud\s+run\s+deploy\b|vercel\s+--prod\b|firebase\s+deploy\b|docker\s+push\b|npm\s+publish\b)/i;

function extractBashFallbackApproval(rawText: string): LocalCliApprovalRequest | null {
  const codeBlockRegex = /```(?:bash|sh|shell|zsh|powershell|ps1)?\s*\n([\s\S]*?)```/gi;
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = codeBlockRegex.exec(rawText)) !== null) {
    if (m[1]) matches.push(m[1].trim());
  }
  if (matches.length === 0) return null;

  // Sondan başa kontrol et: ajanlar çalıştırılacak komutu genellikle yanıtın en sonuna yazar
  for (let i = matches.length - 1; i >= 0; i--) {
    const candidate = matches[i];
    if (!candidate || candidate.length > 2000) continue;
    // Örnek/şablon komutlarını atla
    if (/<TOKEN>|<URL>|dev_sec_xxxx/i.test(candidate)) continue;
    if (SENSITIVE_ACTION_CMD_REGEX.test(candidate)) {
      const hasDeploy = /gcloud\s+run\s+deploy|vercel\s+--prod|firebase\s+deploy/i.test(candidate);
      const hasPush = /git\s+push/i.test(candidate);
      const description =
        hasDeploy && hasPush
          ? "GitHub push ve canlı dağıtım (deploy)"
          : hasDeploy
          ? "Canlı ortama dağıtım (deploy)"
          : hasPush
          ? "GitHub deposuna gönderim (git push)"
          : "Git / yayın işlemi yürütülecek";

      return {
        command: candidate,
        description,
        riskLevel: hasDeploy || hasPush ? "critical" : "high",
      };
    }
  }
  return null;
}

export function extractLocalCliApproval(
  rawText: string,
  options?: { allowBashFallback?: boolean }
): {
  cleanText: string;
  approval: LocalCliApprovalRequest | null;
} {
  if (!rawText) {
    return { cleanText: "", approval: null };
  }

  if (rawText.includes(LOCAL_APPROVAL_START)) {
    const pattern = new RegExp(
      `${LOCAL_APPROVAL_START}\\s*([\\s\\S]*?)\\s*${LOCAL_APPROVAL_END}`,
      "m"
    );
    const match = rawText.match(pattern);
    if (match && match[1]) {
      const cleanText = rawText.replace(pattern, "").trim();
      const inner = match[1]
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      try {
        const parsed = JSON.parse(inner);
        const command = typeof parsed?.command === "string" ? parsed.command.trim() : "";
        if (command) {
          const description =
            typeof parsed?.description === "string" && parsed.description.trim()
              ? parsed.description.trim()
              : "PC / Mac Runner üzerinde işlem yürütülecek";
          const allowedRisks = new Set(["low", "medium", "high", "critical"]);
          const rawRisk =
            typeof parsed?.riskLevel === "string" ? parsed.riskLevel.toLowerCase() : "";
          const inferredRisk: "low" | "medium" | "high" | "critical" =
            command.includes("deploy") || command.includes("push") || command.includes("rm")
              ? "critical"
              : command.includes("build") || command.includes("install")
              ? "high"
              : "medium";
          const riskLevel = allowedRisks.has(rawRisk)
            ? (rawRisk as "low" | "medium" | "high" | "critical")
            : inferredRisk;

          return {
            cleanText,
            approval: { command, description, riskLevel },
          };
        }
      } catch {
        // Yapısal JSON ayrıştırılamazsa aşağıdaki bash yedeğine düş
      }
    }
  }

  // Yedek katman: Ajan özel etiketi unutsa bile kritik git/deploy bash bloğunu yakala
  if (options?.allowBashFallback) {
    const fallback = extractBashFallbackApproval(rawText);
    if (fallback) {
      return { cleanText: rawText, approval: fallback };
    }
  }

  return { cleanText: rawText, approval: null };
}

