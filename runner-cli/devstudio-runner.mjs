#!/usr/bin/env node

/**
 * DevStudio Local Runner (macOS, Windows & Linux)
 * Kullanıcının bilgisayarında sessizce çalışan ve telefondaki DevStudio web arayüzünden gelen
 * yerel AI CLI ajan görevlerini (Antigravity agy, Claude Code, Gemini CLI) ve terminal komutlarını
 * yerel proje dizinlerinde güvenle yürüten çapraz platform aracı ajan.
 */

import { exec, execFileSync, spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const LOCAL_CLI_PREFIX = "__LOCAL_CLI__::";
const IS_WIN = os.platform() === "win32";
const HOME_DIR = os.homedir();
const SESSIONS_FILE = path.join(HOME_DIR, ".devstudio-runner-sessions.json");

const args = process.argv.slice(2);
let token = process.env.DEVSTUDIO_TOKEN || "";
let serverUrl =
  process.env.DEVSTUDIO_URL || "https://devstudio-51645421078.europe-west1.run.app";

for (const arg of args) {
  if (arg.startsWith("--token=")) {
    token = arg.slice("--token=".length);
  } else if (arg.startsWith("--server=")) {
    serverUrl = arg.slice("--server=".length).replace(/\/+$/, "");
  }
}

if (!token) {
  console.error("\n❌ Hata: Eşleşme anahtarı (token) eksik!");
  console.log("Kullanım: node devstudio-runner.mjs --token=dev_sec_xxxx\n");
  process.exit(1);
}

const deviceName = `${os.hostname()} (${os.platform()} ${os.arch()})`;
const activeTasks = new Set();

function loadSessionMap() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8")) || {};
    }
  } catch {
    // Sessizce sıfırdan başla
  }
  return {};
}

function saveSessionConversation(sessionId, engine, convId) {
  if (!sessionId || !convId) return;
  try {
    const map = loadSessionMap();
    if (!map[sessionId] || typeof map[sessionId] !== "object") {
      map[sessionId] = {};
    }
    map[sessionId][engine] = convId;
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(map, null, 2), "utf8");
  } catch (err) {
    console.warn("⚠️ Oturum kimliği kaydedilemedi:", err.message);
  }
}

function getSessionConversation(sessionId, engine) {
  if (!sessionId) return null;
  const map = loadSessionMap();
  return map[sessionId]?.[engine] || null;
}

function clearSessionConversation(sessionId, engine) {
  if (!sessionId) return;
  try {
    const map = loadSessionMap();
    if (map[sessionId]?.[engine]) {
      delete map[sessionId][engine];
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(map, null, 2), "utf8");
    }
  } catch {
    // ignore
  }
}

function findInPath(cmd) {
  try {
    const lookup = IS_WIN ? "where" : "which";
    const out = execFileSync(lookup, [cmd], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    })
      .trim()
      .split(/\r?\n/)[0];
    if (out && fs.existsSync(out.trim())) {
      return out.trim();
    }
  } catch {
    // PATH içinde yok
  }
  return null;
}

function resolveCliBinary(engine) {
  const candidates = [];

  if (engine === "agy") {
    if (IS_WIN) {
      candidates.push(
        path.join(HOME_DIR, ".gemini", "bin", "agy.exe"),
        path.join(HOME_DIR, ".gemini", "bin", "agy.cmd"),
        path.join(HOME_DIR, ".local", "bin", "agy.exe"),
        path.join(process.env.LOCALAPPDATA || "", "Antigravity", "bin", "agy.exe"),
        path.join(process.env.APPDATA || "", "npm", "agy.cmd")
      );
    } else {
      candidates.push(
        path.join(HOME_DIR, ".gemini", "bin", "agy"),
        path.join(HOME_DIR, ".local", "bin", "agy"),
        "/opt/homebrew/bin/agy",
        "/usr/local/bin/agy"
      );
    }
  } else if (engine === "claude") {
    if (IS_WIN) {
      candidates.push(
        path.join(HOME_DIR, ".local", "bin", "claude.exe"),
        path.join(process.env.APPDATA || "", "npm", "claude.cmd"),
        path.join(HOME_DIR, ".claude", "local", "claude.exe")
      );
    } else {
      candidates.push(
        path.join(HOME_DIR, ".local", "bin", "claude"),
        path.join(HOME_DIR, ".claude", "local", "claude"),
        "/opt/homebrew/bin/claude",
        "/usr/local/bin/claude"
      );
    }
  } else if (engine === "gemini") {
    if (IS_WIN) {
      candidates.push(
        path.join(process.env.APPDATA || "", "npm", "gemini.cmd"),
        path.join(HOME_DIR, ".local", "bin", "gemini.exe")
      );
    } else {
      candidates.push(
        "/opt/homebrew/bin/gemini",
        "/usr/local/bin/gemini",
        path.join(HOME_DIR, ".local", "bin", "gemini")
      );
    }
  }

  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }

  return findInPath(engine);
}

function detectInstalledClis() {
  const engines = ["agy", "claude", "gemini"];
  const detected = {};
  for (const eng of engines) {
    detected[eng] = resolveCliBinary(eng);
  }
  return detected;
}

function buildEnhancedEnv() {
  const extraPaths = IS_WIN
    ? [
        path.join(HOME_DIR, ".gemini", "bin"),
        path.join(HOME_DIR, ".local", "bin"),
        path.join(process.env.APPDATA || "", "npm"),
      ]
    : [
        path.join(HOME_DIR, ".gemini", "bin"),
        path.join(HOME_DIR, ".local", "bin"),
        "/opt/homebrew/bin",
        "/usr/local/bin",
      ];

  const sep = path.delimiter;
  const currentPath = process.env.PATH || "";
  const merged = [...extraPaths.filter(Boolean), currentPath].join(sep);

  return {
    ...process.env,
    PATH: merged,
    NO_COLOR: "1",
    CI: "1",
  };
}

function parseJsonResponse(rawOutput) {
  const text = (rawOutput || "").trim();
  if (!text) return null;

  // 1. Doğrudan JSON olarak dene
  try {
    return JSON.parse(text);
  } catch {
    // 2. Satır satır sondan başa JSON objesi ara (spinner/log satırlarını atlamak için)
    const lines = text.split(/\r?\n/).reverse();
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          return JSON.parse(trimmed);
        } catch {
          // devam
        }
      }
    }
    // 3. Metin içindeki son { ... } bloğunu dene
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {
        // yok
      }
    }
  }
  return null;
}

function spawnCommand(binary, cmdArgs, cwd, timeoutMs = 600000) {
  return new Promise((resolve) => {
    const needsShell = IS_WIN && /\.(cmd|bat)$/i.test(binary);
    const startedAt = Date.now();

    let child;
    try {
      child = spawn(binary, cmdArgs, {
        cwd,
        env: buildEnhancedEnv(),
        shell: needsShell,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (spawnErr) {
      resolve({
        stdout: "",
        stderr: spawnErr.message || String(spawnErr),
        exitCode: 1,
        durationSeconds: 0,
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try {
          child.kill("SIGTERM");
        } catch {
          // ignore
        }
        resolve({
          stdout,
          stderr: stderr + "\n[Runner Zaman Aşımı: İşlem 10 dakikayı aştı ve durduruldu]",
          exitCode: 124,
          durationSeconds: Math.round((Date.now() - startedAt) / 1000),
        });
      }
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({
          stdout,
          stderr: stderr + "\n" + (err.message || String(err)),
          exitCode: 1,
          durationSeconds: Math.round((Date.now() - startedAt) / 1000),
        });
      }
    });

    child.on("close", (code) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          exitCode: typeof code === "number" ? code : 0,
          durationSeconds: Math.round((Date.now() - startedAt) / 1000),
        });
      }
    });
  });
}

function getGitChangedFiles(cwd) {
  try {
    const out = execFileSync("git", ["status", "--short"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    }).trim();
    if (!out) return [];
    return out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 20);
  } catch {
    return [];
  }
}

async function runLocalCliTask(task, cliPayload) {
  const { engine, model, mode, prompt, sessionId } = cliPayload;
  const binary = resolveCliBinary(engine);

  if (!binary) {
    const installHint =
      engine === "agy"
        ? "Antigravity CLI (agy) bilgisayarınızda bulunamadı. DevStudio içindeki 'Kurulum Rehberi' ikonundan kurulum adımlarına bakabilirsiniz."
        : engine === "claude"
        ? "Claude Code CLI (`claude`) bilgisayarınızda bulunamadı (`npm i -g @anthropic-ai/claude-code`)."
        : "Gemini CLI (`gemini`) bilgisayarınızda bulunamadı (`npm i -g @google/gemini-cli`).";

    return {
      isLocalCli: true,
      engine,
      model,
      mode,
      exitCode: 1,
      durationSeconds: 0,
      changedFiles: [],
      output: `❌ **Yerel CLI Bulunamadı (${engine})**\n\n${installHint}`,
    };
  }

  if (!task.projectPath || !fs.existsSync(task.projectPath)) {
    return {
      isLocalCli: true,
      engine,
      model,
      mode,
      exitCode: 1,
      durationSeconds: 0,
      changedFiles: [],
      output: `❌ **Proje Klasörü Bulunamadı**\n\nBelirtilen dizin bu bilgisayarda mevcut değil: \`${task.projectPath}\`\n\nLütfen **Projeler** ekranından bu bilgisayardaki doğru yerel dizin yolunu güncelleyin.`,
    };
  }

  // Güvenlik kuralı: Kullanıcı açıkça istemeden asla push/deploy/yıkıcı silme yapma
  const safetyPrefix =
    mode === "plan"
      ? "[DEVSTUDIO MOBİL PLAN MODU]: Yalnızca inceleme, analiz ve tasarım yap. Dosya değiştirme veya terminal komutu çalıştırma. Yanıtını Türkçe, net ve mobil ekranda okunaklı ver.\n\n"
      : "[DEVSTUDIO MOBİL GELİŞTİR MODU]: Proje içindeki AGENTS.md kurallarına uy. Kod geliştirme, dosya düzenleme ve yerel build/tip testi yapabilirsin. Ancak kullanıcı bu mesajda AÇIKÇA istemedikçe ASLA `git push`, `gcloud run deploy`, `vercel --prod` veya yıkıcı `rm -rf` komutu çalıştırma. Yanıtını Türkçe, özlü ve net ver.\n\n";

  const effectivePrompt = `${safetyPrefix}${prompt}`;
  const savedConvId = getSessionConversation(sessionId, engine);

  const buildArgs = (convId) => {
    if (engine === "agy") {
      const a = ["-p", effectivePrompt, "--output-format", "json", "--print-timeout", "540s"];
      if (model && model !== "default") {
        a.push("--model", model);
      }
      if (mode === "plan") {
        a.push("--mode", "plan");
      } else {
        a.push("--mode", "auto");
      }
      if (convId) {
        a.push("--conversation", convId);
      }
      return a;
    }

    if (engine === "claude") {
      const a = ["-p", effectivePrompt, "--output-format", "json"];
      if (mode === "plan") {
        a.push("--permission-mode", "plan");
      }
      if (convId) {
        a.push("--resume", convId);
      }
      return a;
    }

    // gemini CLI
    return ["-p", effectivePrompt];
  };

  console.log(`\n🧠 [${task.projectName}] Yerel CLI Ajanı başlatılıyor...`);
  console.log(`   🤖 Motor:  ${engine} (${model || "default"}) [${mode}]`);
  console.log(`   📂 Dizin:  ${task.projectPath}`);
  if (savedConvId) {
    console.log(`   💬 Oturum: ${savedConvId.slice(0, 12)}... (devam ediliyor)`);
  }

  let run = await spawnCommand(binary, buildArgs(savedConvId), task.projectPath, 570000);

  // Eğer kayıtlı conversation_id geçersiz/eski olduğu için hata aldıysa temiz oturumla 1 kez yeniden dene
  if (run.exitCode !== 0 && savedConvId) {
    console.log("   🔄 Kayıtlı CLI oturumu yenileniyor, temiz oturumla tekrar deneniyor...");
    clearSessionConversation(sessionId, engine);
    run = await spawnCommand(binary, buildArgs(null), task.projectPath, 570000);
  }

  let responseText = "";
  let durationSeconds = run.durationSeconds;

  if (engine === "agy" || engine === "claude") {
    const parsed = parseJsonResponse(run.stdout);
    if (parsed) {
      const newConvId = parsed.conversation_id || parsed.session_id;
      if (newConvId) {
        saveSessionConversation(sessionId, engine, newConvId);
      }
      if (typeof parsed.duration_seconds === "number") {
        durationSeconds = Math.round(parsed.duration_seconds);
      }
      responseText = (parsed.response || parsed.result || parsed.text || "").trim();
      if (!responseText && parsed.error) {
        responseText = `❌ CLI Hatası: ${typeof parsed.error === "string" ? parsed.error : JSON.stringify(parsed.error)}`;
      }
    }
  }

  if (!responseText) {
    const fallbackOut = (run.stdout || "").trim() || (run.stderr || "").trim();
    responseText = fallbackOut || "(Yerel CLI boş yanıt döndü)";
  }

  const changedFiles = mode === "auto" ? getGitChangedFiles(task.projectPath) : [];

  return {
    isLocalCli: true,
    engine,
    model,
    mode,
    exitCode: run.exitCode,
    durationSeconds,
    changedFiles,
    output: responseText,
  };
}

const detectedClis = detectInstalledClis();

console.log("\n=======================================================");
console.log("🚀 DevStudio Local Runner (macOS / Windows / Linux)");
console.log("=======================================================");
console.log(`📡 Sunucu:  ${serverUrl}`);
console.log(`🔑 Token:   ${token.slice(0, 16)}...`);
console.log(`💻 Cihaz:   ${deviceName}`);
console.log("🤖 Algılanan Yerel AI CLI Araçları:");
for (const [eng, binPath] of Object.entries(detectedClis)) {
  console.log(`   ${binPath ? "🟢" : "⚪"} ${eng.padEnd(7)} : ${binPath || "Kurulu değil"}`);
}
console.log("-------------------------------------------------------");

async function sendAction(action, payload = {}) {
  try {
    const res = await fetch(`${serverUrl}/api/runner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        action,
        deviceName,
        payload: {
          ...payload,
          platform: os.platform(),
          availableClis: Object.keys(detectedClis).filter((k) => Boolean(detectedClis[k])),
        },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.error || `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handlePendingTasks(tasks) {
  if (!tasks || tasks.length === 0) return;

  for (const task of tasks) {
    if (activeTasks.has(task.approvalId)) continue;
    activeTasks.add(task.approvalId);

    // Görevi arka planda (heartbeat'i bloklamadan) yürüt
    (async () => {
      try {
        await sendAction("task_started", { approvalId: task.approvalId });

        // A) Yerel AI CLI Ajan Görevi (__LOCAL_CLI__::)
        if (typeof task.command === "string" && task.command.startsWith(LOCAL_CLI_PREFIX)) {
          let cliPayload = null;
          try {
            cliPayload = JSON.parse(task.command.slice(LOCAL_CLI_PREFIX.length));
          } catch {
            cliPayload = null;
          }

          if (!cliPayload) {
            await sendAction("task_completed", {
              approvalId: task.approvalId,
              isLocalCli: true,
              output: "❌ Geçersiz yerel CLI görev formatı.",
              exitCode: 1,
            });
            return;
          }

          const cliRes = await runLocalCliTask(task, cliPayload);
          console.log(
            `\n📤 [${task.projectName}] Yerel CLI tamamlandı (${cliRes.durationSeconds}s, kod: ${cliRes.exitCode}, ${cliRes.output.length} karakter)`
          );
          await sendAction("task_completed", {
            approvalId: task.approvalId,
            ...cliRes,
          });
          console.log(`✅ [${task.projectName}] Yanıt mobil ekrana iletildi.\n`);
          return;
        }

        // B) Standart Terminal Komutu
        console.log(`\n⚡ [${task.projectName}] Onaylanan komut icra ediliyor:`);
        console.log(`   > ${task.command}`);
        console.log(`   📂 Dizin: ${task.projectPath}`);

        await new Promise((resolve) => {
          exec(
            task.command,
            {
              cwd: task.projectPath,
              maxBuffer: 1024 * 1024 * 8,
              env: buildEnhancedEnv(),
              windowsHide: true,
            },
            async (error, stdout, stderr) => {
              const output = (stdout || "") + (stderr ? (stdout ? "\n" : "") + stderr : "");
              let exitCode = error ? (typeof error.code === "number" ? error.code : 1) : 0;
              if (exitCode === 1 && output.includes("nothing to commit, working tree clean")) {
                exitCode = 0;
              }

              console.log(
                `\n📤 Çıktı (${output.length} bayt, kod: ${exitCode}) DevStudio sunucusuna iletiliyor...`
              );
              await sendAction("task_completed", {
                approvalId: task.approvalId,
                output: output.trim() || "(Boş çıktı)",
                exitCode,
              });
              console.log(`✅ [${task.projectName}] İşlem tamamlandı ve mobil ekrana aktarıldı.\n`);
              resolve();
            }
          );
        });
      } catch (err) {
        console.error("❌ Görev yürütme hatası:", err);
        await sendAction("task_completed", {
          approvalId: task.approvalId,
          isLocalCli: typeof task.command === "string" && task.command.startsWith(LOCAL_CLI_PREFIX),
          output: `❌ Runner yürütme hatası: ${err.message || String(err)}`,
          exitCode: 1,
        }).catch(() => {});
      } finally {
        activeTasks.delete(task.approvalId);
      }
    })();
  }
}

// 1. İlk Bağlantı
async function init() {
  console.log("⏳ DevStudio sunucusuna bağlanılıyor...");
  const res = await sendAction("connect");

  if (!res.ok) {
    console.error(`❌ Bağlantı başarısız: ${res.error}`);
    console.log("Lütfen token'ınızı ve internet bağlantınızı kontrol ediniz.\n");
    process.exit(1);
  }

  console.log("✅ Başarıyla bağlandı! DevStudio kokpiti bilgisayarınızı görüyor.");
  console.log("\n📂 Dinlenen ve Yönetilen Projeler:");
  const projects = res.data?.projects || [];

  if (projects.length === 0) {
    console.log("  (Henüz tanımlı proje yok)");
  } else {
    for (const p of projects) {
      const exists = p.localPath && fs.existsSync(p.localPath);
      const icon = exists ? "🟢" : "⚠️ ";
      console.log(`  ${icon} [${p.name}]: ${p.localPath} ${exists ? "" : "(Klasör bulunamadı!)"}`);
    }
  }

  console.log("\n-------------------------------------------------------");
  console.log("📱 Artık telefonunuzdan Yerel Ajan veya terminal komutu verebilirsiniz.");
  console.log("💡 Çıkış yapmak için Ctrl+C tuşlarına basabilirsiniz.");
  console.log("=======================================================\n");

  if (res.data?.pendingTasks) {
    await handlePendingTasks(res.data.pendingTasks);
  }

  // 2. Canlı Heartbeat ve Görev Yoklama (Her 2 saniyede bir - hızlı mobil deneyim)
  setInterval(async () => {
    const hb = await sendAction("heartbeat");
    if (hb.ok) {
      if (hb.data?.pendingTasks && hb.data.pendingTasks.length > 0) {
        await handlePendingTasks(hb.data.pendingTasks);
      } else if (activeTasks.size === 0) {
        process.stdout.write(
          `\r💓 Canlı bağlantı aktif [${new Date().toLocaleTimeString("tr-TR")}]`
        );
      }
    } else {
      process.stdout.write(
        `\r⚠️  Bağlantı koptu, yeniden deneniyor... [${new Date().toLocaleTimeString("tr-TR")}]`
      );
    }
  }, 2000);
}

// 3. Temiz Çıkış (Graceful Shutdown)
async function shutdown() {
  console.log("\n\n🛑 DevStudio Runner kapatılıyor...");
  await sendAction("disconnect").catch(() => {});
  console.log("👋 Görüşmek üzere!\n");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

init();
