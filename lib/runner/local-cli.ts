export const LOCAL_CLI_PREFIX = "__LOCAL_CLI__::";

export type LocalCliEngine = "agy" | "claude" | "gemini";
export type LocalCliMode = "plan" | "auto";

export interface LocalCliPayload {
  engine: LocalCliEngine;
  model: string;
  mode: LocalCliMode;
  prompt: string;
  sessionId: string;
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

