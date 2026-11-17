# DevStudio - Mobil Öncelikli Yapay Zeka Geliştirici Stüdyosu (Analysis.md)

Bu doküman, geliştiricilerin ve girişimcilerin bilgisayar başına bağımlı kalmadan cep telefonlarından projelerini (AllTripX, BurstaBugun vb.) yönetmelerini, kod geliştirmelerini, test etmelerini ve canlıya dağıtmalarını sağlayan **DevStudio** platformunun mimari analiz ve tasarım spesifikasyonudur.

---

## 1. Ürün Vizyonu ve Değer Önermesi
- **Problem:** Mevcut AI geliştirme araçları (Cursor, Antigravity, VS Code) geliştiriciyi masaüstü bilgisayara ve masaya mahkum eder. Chrome Remote gibi masaüstü paylaşım araçları ise mobilde kullanışsız ve yorucudur.
- **Çözüm:** Telefonun tarayıcısından (veya PWA uygulamasından) girilen, WhatsApp ferahlığında bir mobil chat arayüzü. 
- **Temel Özellik:** Kullanıcı projesini ve AI modelini seçer, ister metinle ister sesle ister ekran görüntüsüyle talimat verir; arka planda çalışan yerel dinleyici (Runner) kullanıcının bilgisayarında kodlamayı yapar, testleri geçer, GitHub'a pushlar ve buluta deploy eder.

---

## 2. AllTripX Projesinden Miras Alınacak Kanıtlanmış Altyapı
Sıfırdan tekerleği yeniden icat etmemek ve üretim kalitesini korumak için AllTripX'te mükemmelleştirilen modüller doğrudan entegre edilecektir:

1. **Kimlik Doğrulama & Oturum Güvenliği (Auth & Session):**
   - NextAuth.js v5 JWT stratejisi.
   - E-posta ve Telefon numarası ile çift yönlü giriş desteği.
   - `bcryptjs` parola hashleme (salt 10).
   - HTTP 431 güvenliği (büyük profil fotoğraflarının cookie'ye yazılmasını engelleyen bağımsız binary avatar servisi).
2. **Kullanıcı & Üyelik Yönetimi:**
   - Kayıt olma (Register), Şifremi Unuttum, Şifre Değiştirme.
   - Hesap durumları (`active`, `suspended`) ve rol hiyerarşisi (`admin`, `developer`, `user`).
3. **Yasal Uyum, KVKK & Sözleşme Denetimi (`ContractEnforcer`):**
   - KVKK Açık Rıza Metni, Kullanıcı Sözleşmesi, Gizlilik Politikası.
   - Onaylanmamış sözleşmelerde arayüzü kilitleyip zorunlu onay modalı getiren koruma kalkanı.
4. **Çift Dilli Altyapı (Bilingual i18n):**
   - Türkçe / İngilizce anlık geçiş düğmesi.
   - Modüler sözlük mimarisi (`lib/i18n/dictionaries`).
5. **Lüks Karanlık Tasarım Sistemi (Design Aesthetics):**
   - Tailwind CSS v4, koyu slate arka plan (`bg-slate-950 / bg-slate-900`).
   - Mücevher tonlarında parlayan mikro animasyonlu butonlar.
   - **Kural 13 Mobil Öncelik:** Minimum 44px dokunmatik hedefler, sıfır yatay kaydırma (`zero-horizontal-scroll`).

---

## 3. Kullanıcı Entegrasyon ve Yönetim Paneli (Settings & Vault)
Kullanıcının kendi araçlarını güvenle tanımlayacağı self-servis panel:

1. **AI Sağlayıcıları Yönetimi (BYOK - Bring Your Own Key):**
   - **Google AI Studio (Gemini):** Ücretsiz kota (günde 1.500 istek / $0 maliyet) için API anahtarı girişi.
   - **Anthropic (Claude) & OpenAI (GPT-4o):** İsteğe bağlı alternatif model anahtarları.
   - **Kriptografik Güvenlik:** Tüm API anahtarları veritabanında **AES-256-GCM** algoritması ve kullanıcıya özel tuz (salt) ile şifrelenir; ekranda asla açık metin gösterilmez.
2. **Proje Havuzu (Workspace Registry):**
   - Kullanıcı geliştirmek istediği projeleri ekler:
     - Proje Adı: `AllTripX` / `BurstaBugun`
     - Yerel Dizin Yolu: `/Users/erhanayyildiz/Desktop/Work/TatildeBugun`
     - GitHub Deposu: `https://github.com/erhanayyildiz/tatildebugun.git`
     - Dağıtım Tipi: `Google Cloud Run` / `Vercel` / `Docker`
3. **Eşleşme ve Yetkilendirme Anahtarı (Runner Pairing Token):**
   - Sistem her kullanıcı için yüksek entropili bir eşleşme anahtarı üretir (`dev_sec_9a8f...`).
   - Kullanıcı bu anahtarı kendi Mac veya Windows bilgisayarında bir kez girerek cihazını bağlar.

---

## 4. Mac / Windows Yerel Dinleyici Mekanizması (DevStudio Runner)

### 4.1. Ağ İletişimi Mimarisi (Neden Güvenlik Duvarı ve Port Gerekmez?)
- **Geleneksel Yanlış Yaklaşım:** Bilgisayarda port açmak (port forward), statik IP almak. (Güvensizdir ve zordur).
- **DevStudio Yaklaşımı: Dışa Dönük Güvenli WebSocket (Outbound WSS / TLS 1.3):**
  - Tıpkı Slack, WhatsApp Web veya Discord mantığında olduğu gibi; kullanıcının bilgisayarı DevStudio bulut sunucusuna doğru güvenli bir WebSocket tüneli açar.
  - Modem ayarı, port açma veya router yapılandırması **KESİNLİKLE GEREKMEZ**.

### 4.2. Çalıştırma Yöntemleri
1. **CLI Yöntemi (Hızlı & Geliştirici Dostu):**
   ```bash
   npx devstudio-runner --token=dev_sec_xxxx
   ```
2. **Masaüstü Arka Plan Aracı (Tray App - Mac / Windows):**
   - Menü çubuğunda (Mac menü barı / Windows bildirim alanı) küçük yeşil bir simge olarak çalışır.
   - "Bağlı - AllTripX Dinleniyor" durumunu gösterir.

### 4.3. Yerel Ajanın Çalışma Döngüsü (Agent Loop)
1. Telefondan gelen prompt'u alır.
2. İlgili proje dizinindeki dosyaları tarar / inceler.
3. Değişiklikleri kodlar.
4. Terminalde derleme ve linter testlerini (`npm run build`, `tsc`) koşar.
5. Kullanıcıdan onay geldikten sonra `git push` ve bulut dağıtımını (`gcloud run deploy`) başlatır.
6. Canlı logları ve ilerlemeyi telefon ekranına daktilo gibi yansıtır.

---

## 5. Kritik Soru: "PC Başındaki Onayları (Approval) Mobilde Nasıl Vereceğim?"

### 5.1. Chat İçi İnteraktif Onay Kartları (Interactive In-Chat Action Cards)
Ajan kritik bir aşamaya geldiğinde (örneğin terminal komutu çalıştırma, dosya silme, git push veya deploy işlemi), sohbet akışının içerisine **anında canlı bir Onay Kartı** düşürür:

```text
┌─────────────────────────────────────────────────────────┐
│ 🛡️ İŞLEM ONAYI GEREKİYOR                                │
│                                                         │
│ Proje: AllTripX                                         │
│ İşlem: Canlıya Dağıtım (Production Deploy)              │
│ Komut: gcloud run deploy tatilde-bugun ...              │
│ Risk Seviyesi: Kritik (Canlı Ortam)                     │
├─────────────────────────────────────────────────────────┤
│ [ ✅ Onayla ve Çalıştır ]         [ ❌ Reddet / İptal ] │
└─────────────────────────────────────────────────────────┘
```

- **Kullanım Deneyimi:** Telefonunuzda tek başparmak dokunuşuyla **[ ✅ Onayla ve Çalıştır ]** butonuna basarsınız.
- Butona basıldığı an WebSocket üzerinden milisaniyeler içinde Mac/PC'deki dinleyiciye `approval: true` sinyali ulaşır ve işlem başlar.
- Reddederseniz ajana *"Kullanıcı bu işlemi reddetti"* bilgisi döner ve ajan alternatif bir yol önerir.

### 5.2. Akıllı Onay Politikaları (Kullanıcı Tercihine Göre Ayarlanabilir)
Kullanıcı Ayarlar sayfasından kendi çalışma tarzına uygun onay seviyesini seçebilir:
1. **Katı Güvenlik Modu (Strict Safe):** Her dosya değişikliğinde ve her terminal komutunda telefona onay butonu çıkarır.
2. **Akıllı Geliştirici Modu (Balanced - Önerilen):** Dosya okuma ve kod yazma işlemlerini otonom yapar; yalnızca terminal çalıştırma, `git push` ve `cloud deploy` işlemlerinde telefona onay butonu çıkarır.
3. **Tam Otonom Mod (Autonomous):** Önceden belirlenen testler başarılıysa dağıtıma kadar tüm süreci otomatik tamamlar, bitince telefona özet geçer.

---

## 6. Proje Dizin Yapısı (`/Users/erhanayyildiz/Desktop/Work/DevStudio`)

```text
DevStudio/
├── app/
│   ├── (auth)/                   # Login, Register, Forgot Password
│   ├── (dashboard)/
│   │   ├── chat/                 # Mobil Öncelikli AI Geliştirme Chat Ekranı
│   │   │   └── page.tsx
│   │   ├── projects/             # Proje Yönetimi (AllTripX, BurstaBugun)
│   │   ├── settings/             # API Key Vault & Runner Pairing Token
│   │   └── page.tsx              # Ana Kontrol Paneli
│   ├── api/
│   │   ├── runner/ws/            # Runner WebSocket Ağ Geçidi
│   │   ├── chat/stream/          # SSE / WebSocket Canlı Ajan Çıktısı
│   │   └── upload/               # Ekran Görüntüsü / Dosya Yükleme
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── chat/
│   │   ├── chat-view.tsx         # Mobil Chat Arayüzü
│   │   ├── approval-card.tsx     # Chat İçi İnteraktif Onay Kartı
│   │   ├── code-diff-card.tsx    # Kod Değişikliği Önizleme Kartı
│   │   └── model-selector.tsx    # Model Seçici (Gemini / Claude / GPT)
│   ├── navigation/               # Lüks Üst Bar ve Mobil Menü
│   └── ui/                       # Düğmeler, Modallar, Rozetler
├── lib/
│   ├── agent/
│   │   ├── engine.ts             # AI Ajan Çekirdeği (Tool Calling & Prompting)
│   │   ├── tools.ts              # Dosya okuma, yazma, terminal araçları
│   │   └── approval.ts           # Onay bekleme & çözme yöneticisi
│   ├── crypto/                   # AES-256 Vault Şifreleme
│   ├── db/                       # Drizzle ORM & Postgres Şeması
│   └── i18n/                     # TR / EN Dil Desteği
├── runner-cli/                   # Mac & Windows'ta Çalışacak Hafif CLI
│   ├── index.ts
│   ├── client.ts                 # Buluta bağlanan WSS istemcisi
│   └── executor.ts               # Yerel terminal ve dosya yürütücüsü
├── Analysis.md                   # Mimari Kararlar ve Analiz Kütüğü
├── AGENTS.md                     # Antigravity Geliştirici Kuralları
├── Security.md                   # Güvenlik ve İzolasyon Standartları
└── package.json
```

---

## 7. Sonraki Adımlar ve Geliştirme Sırası
1. Kullanıcıdan bu analiz ve onay kartı tasarımına istinaden **"Onaylıyorum, Geliştirmeyi Yapabilirsin"** komutunun alınması.
2. Next.js 16 + React 19 + Tailwind v4 çekirdek projesinin oluşturulması.
3. AllTripX'ten kanıtlanmış Auth, KVKK, i18n ve Veritabanı şablonunun aktarılması.
4. Settings (API Vault & Pairing Token) ve Projects ekranlarının kodlanması.
5. Mobil Chat & Onay Kartı (`approval-card.tsx`) bileşeninin hazırlanması.
6. Mac/Windows yerel dinleyicisi (`runner-cli`) prototipinin ayağa kaldırılması ve ilk canlı uçtan uca testin yapılması.
