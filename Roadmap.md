# DevStudio Yol Haritası (Roadmap)

## Gelecek Vizyonu ve Mimari İyileştirmeler
- [ ] **Custom Domain Entegrasyonu:** Servisin `*.run.app` yerine `devstudio.bugunai.com` altında, otomatik SSL ve Cloud Run Domain Mapping ile konumlandırılması.

## Ürünleştirme ve Geliştirici Deneyimi (DX)
- [ ] **İnteraktif Kurulum Sihirbazı (Setup Wizard — `/setup`):**
  - **Konum:** Üst navigasyonda **Kasa & Entegrasyonlar** sekmesinin hemen yanında **`🪄 Kurulum Sihirbazı`** bağlantısı (mobilde sıfır yatay kaydırma, minimum 44px dokunma hedefi).
  - **Yerleşim (Setup Ekranı Deneyimi):**
    - *Masaüstü:* Sol sütunda alt alta numaralı 5 adımlı ilerleme listesi (`✅ / ⏳` canlı durumlu); sağ panelde aktif adımın form alanları (silik örnek `placeholder` değerleriyle) ve yanında **"Nereden Elde Edilir?"** rehber açıklaması.
    - *Mobil (360px–430px):* Üstte kompakt adım göstergesi (`Adım X / 5`), ortada aktif form + silik örnek değerler, hemen altında katlanabilir *"Nereden Alırım?"* açıklaması ve altta sabit `Geri / Kaydet & İlerle` butonları.
  - **5 Adımlı Akış:**
    1. **Bilgisayar & Yerel AI CLI Hazırlığı:** macOS / Windows seçimi, Node.js 18+ ve Antigravity (`agy`) / Claude Code / Gemini CLI kontrolü + nereden kurulacağı.
    2. **Runner Eşleştirme & Canlı Test:** Kişisel eşleşme anahtarı gömülü tek komut + 7/24 tatil modu seçeneği + canlı `ONLINE` bağlantı doğrulaması.
    3. **İlk Proje Tanımı (Zorunlu):** Proje Adı (örn. `AllTripX`), Yerel Dizin Yolu (Mac/Windows silik örnekli), GitHub Repo URL ve Deploy Komutu + *"Bu yolu bilgisayarda nasıl bulurum?"* rehberi.
    4. **Kasa & Bulut API (Opsiyonel):** Ücretsiz Google AI Studio Gemini anahtarı (`AIzaSy...` silik örnekli) + *"aistudio.google.com'dan 30 saniyede nasıl alınır?"* açıklaması + **"Atla (Yerel Ajan Yeterli — $0 Ek Maliyet)"** butonu.
    5. **Özet & Başlat:** Tüm ayarların yeşil durum özeti ve tek tıkla Geliştirme Sohbeti'ne geçiş.
- [ ] **Kapsamlı 'Getting Started' & Onboarding Akışı:** Projenin yerelde nasıl ayağa kaldırılacağı, ön şartların (Node, Python, gcloud vb.), ortam tanımlarının ve yeni proje açma akışının adım adım anlatıldığı geliştirici dokümantasyonu.
