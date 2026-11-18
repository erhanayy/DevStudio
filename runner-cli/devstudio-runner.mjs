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

  // 2. Canlı Heartbeat (Her 8 saniyede bir)
  setInterval(async () => {
    const hb = await sendAction("heartbeat");
    if (hb.ok) {
      process.stdout.write(`\r💓 Canlı bağlantı aktif [${new Date().toLocaleTimeString("tr-TR")}]`);
    } else {
      process.stdout.write(`\r⚠️  Bağlantı koptu, yeniden deneniyor... [${new Date().toLocaleTimeString("tr-TR")}]`);
    }
  }, 8000);
}

// 3. Temiz Çıkış (Graceful Shutdown)
process.on("SIGINT", async () => {
  console.log("\n\n🛑 DevStudio Runner kapatılıyor...");
  await sendAction("disconnect").catch(() => {});
  console.log("👋 Görüşmek üzere!\n");
  process.exit(0);
});

init();
