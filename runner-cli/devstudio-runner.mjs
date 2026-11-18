#!/usr/bin/env node

/**
 * DevStudio Local Runner (Mac & Windows)
 * Kullanıcının bilgisayarında sessizce çalışan ve telefondaki DevStudio web arayüzünden gelen
 * kodlama, test ve deploy komutlarını yerel olarak yürüten hafif aracı ajan.
 */

import { exec } from "child_process";
import fs from "fs";
import os from "os";

const args = process.argv.slice(2);
let token = "";
let serverUrl = process.env.DEVSTUDIO_URL || "https://devstudio-51645421078.europe-west1.run.app";

for (const arg of args) {
  if (arg.startsWith("--token=")) {
    token = arg.split("=")[1];
  } else if (arg.startsWith("--server=")) {
    serverUrl = arg.split("=")[1];
  }
}

if (!token) {
  console.error("\n❌ Hata: Eşleşme anahtarı (token) eksik!");
  console.log("Kullanım: node devstudio-runner.mjs --token=dev_sec_xxxx\n");
  process.exit(1);
}

const deviceName = `${os.hostname()} (${os.platform()} ${os.arch()})`;
const activeTasks = new Set();

console.log("\n=======================================================");
console.log("🚀 DevStudio Local Runner (Mac & Windows)");
console.log("=======================================================");
console.log(`📡 Sunucu: ${serverUrl}`);
console.log(`🔑 Token:  ${token.slice(0, 16)}...`);
console.log(`💻 Cihaz:  ${deviceName}`);
console.log("-------------------------------------------------------");

async function sendAction(action, payload = {}) {
  try {
    const res = await fetch(`${serverUrl}/api/runner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action, deviceName, payload }),
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

    console.log(`\n⚡ [${task.projectName}] Onaylanan komut icra ediliyor:`);
    console.log(`   > ${task.command}`);
    console.log(`   📂 Dizin: ${task.projectPath}`);

    await sendAction("task_started", { approvalId: task.approvalId });

    exec(
      task.command,
      { cwd: task.projectPath, maxBuffer: 1024 * 1024 * 5 },
      async (error, stdout, stderr) => {
        const output = (stdout || "") + (stderr ? (stdout ? "\n" : "") + stderr : "");
        const exitCode = error ? (typeof error.code === "number" ? error.code : 1) : 0;

        console.log(`\n📤 Çıktı (${output.length} bayt, kod: ${exitCode}) DevStudio sunucusuna iletiliyor...`);
        await sendAction("task_completed", {
          approvalId: task.approvalId,
          output: output.trim() || "(Boş çıktı)",
          exitCode,
        });

        activeTasks.delete(task.approvalId);
        console.log(`✅ [${task.projectName}] İşlem tamamlandı ve mobil ekrana aktarıldı.\n`);
      }
    );
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

  console.log("✅ Başarıyla bağlandı! DevStudio kokpiti Mac'inizi görüyor.");
  console.log("\n📂 Dinlenen ve Yönetilen Projeler:");
  const projects = res.data?.projects || [];

  if (projects.length === 0) {
    console.log("  (Henüz tanımlı proje yok)");
  } else {
    for (const p of projects) {
      const exists = fs.existsSync(p.localPath);
      const icon = exists ? "🟢" : "⚠️ ";
      console.log(`  ${icon} [${p.name}]: ${p.localPath} ${exists ? "" : "(Klasör bulunamadı!)"}`);
    }
  }

  console.log("\n-------------------------------------------------------");
  console.log("📱 Artık telefonunuzdan komut verebilirsiniz.");
  console.log("💡 Çıkış yapmak için Ctrl+C tuşlarına basabilirsiniz.");
  console.log("=======================================================\n");

  if (res.data?.pendingTasks) {
    await handlePendingTasks(res.data.pendingTasks);
  }

  // 2. Canlı Heartbeat ve Görev Yoklama (Her 4 saniyede bir)
  setInterval(async () => {
    const hb = await sendAction("heartbeat");
    if (hb.ok) {
      if (hb.data?.pendingTasks && hb.data.pendingTasks.length > 0) {
        await handlePendingTasks(hb.data.pendingTasks);
      } else {
        process.stdout.write(`\r💓 Canlı bağlantı aktif [${new Date().toLocaleTimeString("tr-TR")}]`);
      }
    } else {
      process.stdout.write(`\r⚠️  Bağlantı koptu, yeniden deneniyor... [${new Date().toLocaleTimeString("tr-TR")}]`);
    }
  }, 4000);
}

// 3. Temiz Çıkış (Graceful Shutdown)
process.on("SIGINT", async () => {
  console.log("\n\n🛑 DevStudio Runner kapatılıyor...");
  await sendAction("disconnect").catch(() => {});
  console.log("👋 Görüşmek üzere!\n");
  process.exit(0);
});

init();
