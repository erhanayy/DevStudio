# DevStudio - Dağıtım Yönetimi (Deployment.md)

Bu dokümanda DevStudio platformunun bulut dağıtım adımları ve geçmişi kayıt altına alınacaktır. Kural 3 uyarınca kullanıcı onayı olmadan dağıtım yapılamaz.

## Dağıtım Geçmişi

| Sürüm | Tarih | Ortam | Değişiklik Özeti | Durum |
| :--- | :--- | :--- | :--- | :--- |
| v2.5.1 | 2026-11-20 | Production (`europe-west1`) | Yerel CLI Ek Görsel/Dosya Okuma Garantisi (Madde 28): `agy` ve `claude` CLI çağrılarına `--add-dir <attachmentsDir>` eklenerek mobil ekran görüntüleri/eklerin proje dışı izin engeline takılmadan doğrudan okunması sağlandı; ek çipi `X` kaldırma butonu `44px` dokunma hedefine yükseltildi | Canlıda & Aktif (`devstudio-00029-676`) |
| v2.5.0 | 2026-11-20 | Production (`europe-west1`) | Tak-Çalıştır Mobil Onay Kartı Köprüsü, Ek Dosya & Tam TR/EN i18n (Madde 23–27): 1) Yerel CLI (`agy`/`claude`/`gemini`) için çift katmanlı `<<<DEVSTUDIO_APPROVAL>>>` + bash yedek onay kartı yakalayıcısı (sıfır `/permissions` ayarı ile telefondan tek tıkla `git push` ve `gcloud run deploy`); 2) Varsayılan `Geliştir` modu + tek dokunuşluk `🛡️ Plan` kilidi; 3) Uçtan uca görsel/dosya eki gönderimi ve yerel CLI okuma köprüsü; 4) Kurulum Rehberi Adım 5–6 genişletmesi; 5) Tam TR/EN çift dilli arayüz ve Cloud Build spinner çıktı temizleyici | Arşivlendi (`devstudio-00028-r97`) |
| v2.4.0 | 2026-11-19 | Production (`europe-west1`) | Mac + Windows Çapraz Platform Runner Yerel CLI Ajan Köprüsü & Kurulum Rehberi (Madde 22): Antigravity (`agy`), Claude Code (`claude`) ve Gemini CLI (`gemini`) otomatik keşfi, oturum bazlı konuşma hafızası (`--conversation`), `Plan`/`Geliştir` güvenlik modları, 0 ek API maliyeti, `/api/runner/download` tek komut kurulum uç noktası, macOS (`caffeinate`) ve Windows (PowerShell) 7/24 uyku korumalı scriptler ve adım adım mobil-first Kurulum Rehberi modalı | Arşivlendi (`devstudio-00026-s9d`) |
| v2.3.0 | 2026-11-19 | Production (`europe-west1`) | 1) Onay Kartı (`ApprovalCard`) Dinamik Durum Başlığı & Renk Mimarisi (Madde 19): `completed` durumunda yeşil "İşlem Tamamlandı", `running`/`approved` durumunda cyan "İşlem Yürütülüyor...", `failed`/`rejected` durumlarında net renk ve başlık geçişleri, terminal durumlarında `animate-pulse` durdurma; 2) Tek Dokunuşla Kopyala Butonu (Madde 20): AI ve Mac Runner mesaj balonlarının altına Mobil-First (`44px` hedef) Kopyala/Kopyalandı butonu ve mobil tarayıcı yedek kopyalama desteği | Arşivlendi (`devstudio-00025-cfj`) |
| v2.2.0 | 2026-11-19 | Production (`europe-west1`) | Gemini 3-Flash Entegrasyonu & 12s Dengeli Zaman Aşımı: Canlı testlerde sıfır hata ile çalışan `gemini-3-flash-preview` varsayılan model yapıldı, zaman aşımı 12s'ye dengelendi, sahte soru soran acil durum şablonu düzeltildi | Arşivlendi (`devstudio-00023-nsf`) |
| v2.1.0 | 2026-11-19 | Production (`europe-west1`) | Hızlı Fallback & 7s Timeout Optimizasyonu: Gemini 3.8 Flash 503 aldığında mobil bağlantı kopmasını ("failed to connect") önlemek için 1.8s süreli `gemini-3.1-flash-lite` acil kurtarma modeli entegre edildi, aday model timeout'u 7 saniyeye indirildi, arayüzde 3.1 Flash Lite hızlı seçeneği eklendi | Arşivlendi (`devstudio-00022-xw6`) |
| v2.0.0 | 2026-11-19 | Production (`europe-west1`) | Gemini 3.8 Flash Amiral Gemisi Entegrasyonu: Google AI Studio 3.8 engeli kaldırıldı, 3.8 Flash öncelikli model ve 3.5/3.1 dinamik yedekleme zinciri kuruldu, Mac Runner analiz motoru 3.8 zekasına yükseltildi | Arşivlendi (`devstudio-00021-nqm`) |
| v1.9.0 | 2026-11-19 | Production (`europe-west1`) | Mobil Görünüm Optimizasyonu: Sol menü butonunun ezilmemesi için min-w, shrink-0 ve z-10 koruması; model seçici sadeleştirmesi ve mobil genişlik kısıtı; mesaj akış kutusunda ve balonlarında sıfır yatay kaydırma (`overflow-x-hidden`, `break-words`, `max-w-full`) garantisi; mobil çekmece karartma perdesi | Arşivlendi (`devstudio-00020-lsw`) |
| v1.8.0 | 2026-11-18 | Production (`europe-west1`) | Doküman Koruma Güvenlik Duvarı: Asistanın prompt kurallarına `Analysis.md`, `Deployment.md` ve doküman dosyalarını baştan sıfırlayarak ('>') yazmasını engelleyen, her zaman sonuna ekleme ('>>') yapmasını zorunlu kılan Kural 4 eklendi | Arşivlendi (`devstudio-00013-ljc`) |
| v1.7.0 | 2026-11-18 | Production (`europe-west1`) | 1) Next.js Server Action Hash Geçersizleşmesi Kalıcı Onarımı: Onay verme (`approve`), reddetme (`reject`) ve durum sorgulama (`approval_status`) işlemleri Server Action'lardan kalıcı ve versiyondan bağımsız standart REST API rotasına (`/api/chat`) geçirildi, 2) Güvenli Durum Geçişi (Pessimistic State): Kart durumu yalnızca sunucu HTTP 200 döndüğünde `approved` yapılarak sahte dolan çubuk engellendi, 3) Kalıcı Arka Plan Reaktif Dinleyicisi REST desteği | Arşivlendi (`devstudio-00012-jhm`) |
| v1.6.0 | 2026-11-18 | Production (`europe-west1`) | 1) Uzun Süren Komutlarda (gcloud deploy / build) Polling Zaman Aşımı: 120s tavanı 600s (10 dakika) seviyesine yükseltildi, 2) Kalıcı Arka Plan Reaktif Dinleyicisi (`useEffect`): Sayfa yenilense veya sekme değişse dahi bekleyen onayları otomatik yakalayıp tamamlayan motor, 3) GitHub Senkronizasyonu: Tüm commit'ler `origin/main`'e başarıyla gönderildi | Arşivlendi (`devstudio-00011-5cs`) |
| v1.5.0 | 2026-11-18 | Production (`europe-west1`) | 1) Kesilmelere Kesin Çözüm: Gemini API'nin çok parçalı (`candidates[0].content.parts`) döndürdüğü yanıtları eksiksiz birleştiren evrensel `extractGeminiText` motoru, 2) Ekrana Kilitli Mobil-First Sohbet Arayüzü: `h-[100dvh]` ve `overflow-hidden` ile dış pencere kayması tamamen engellendi, 3) İç Mesaj Penceresi: Mesajlar bağımsız `overflow-y-auto min-h-0` kutusuna alındı ve otomatik `auto-scroll` odaklama eklendi | Arşivlendi (`devstudio-00009-7zs`) |
| v1.4.0 | 2026-11-18 | Production (`europe-west1`) | 1) İlerleme Çubuğu & Canlı Sayaç: Onay verildiği andan itibaren Mac Runner terminali çalıştırırken arayüzde dinamik olarak dolan gradient çubuk ve saniye sayacı, 2) Sunucu Taraflı Atomik Yürütme: Komut bittiğinde telefonun ikinci bir istek atması yerine sunucu (`/api/runner`) doğrudan Gemini 3.5 Flash Lite motorunu tetikleyip çıktıyı tek parça halinde işler, 3) Temiz Git Ağacı Toleransı: `working tree clean` durumunun kırmızı hata vermesi engellendi; işlem başarıyla tamamlandı olarak kabul edilir, 4) Cloud SQL PostgreSQL `approvals.analysis` kalıcı kolon entegrasyonu | Arşivlendi (`devstudio-00008-mf8`) |
| v1.3.0 | 2026-11-18 | Production (`europe-west1`) | 1) Sol Proje Sekmeleri & Geçmiş Paneli (DevStudio, AllTripX, BurstaBugun), 2) Kalıcı REST Chat API (/api/chat) ile Next.js Server Action hash geçersizleşme hatasının ('failed-to-find-server-action') kalıcı çözümü, 3) 8192 token ve 30s timeout ile yarım kalan yanıtların önlenmesi, 4) Runner komutu tamamlandığında Gemini'ın otomatik devreye girip sonucu açıkladığı Otonom Gözlem Geri Bildirim Döngüsü | Arşivlendi (`devstudio-00007-xs6`) |
| v1.2.0 | 2026-11-18 | Production (`europe-west1`) | Doğal dil sohbet motoru: Google AI Studio için Gemini 3.5 Flash Lite entegrasyonu, 8 mesajlık çok turlu konuşma hafızası (multi-turn context), kalıpsız doğal Türkçe sohbet ve Mac Runner canlı onay kartları | Arşivlendi (`devstudio-00006-gs8`) |
| v1.1.0 | 2026-11-18 | Production (`europe-west1`) | DevStudio'nun kendi kendini geliştirmesi (Dogfooding): Projeler listesine DevStudio eklendi, `/api/runner` senkronizasyon ve canlı heartbeat köprüsü entegre edildi, runner-client çoklu proje desteği kazandı | Arşivlendi |
| v1.0.0 | 2026-11-17 | Production (`devstudio.bugunai.com`) | İlk Canlı Yayın: Google Cloud Run (`europe-west1`), NextAuth v5 kimlik doğrulama, Cloud SQL PostgreSQL (`devstudio`), AES-256 Vault, Çift Dilli i18n, Mobil-First Chat & İnteraktif Onay Kartları | Arşivlendi |
| v0.1.0 | 2026-11-17 | Tasarım & Mimari | Proje analiz ve mimari spesifikasyonu hazırlandı | Analiz Aşamasında |

## Dağıtım Komutları

```bash
# Cloud Run Dağıtımı
gcloud run deploy devstudio \
  --source . \
  --project dernektebugun-492221 \
  --region europe-west1 \
  --allow-unauthenticated \
  --env-vars-file env.cloudrun.yaml \
  --quiet

# Özel Alan Adı Eşleme (Domain Mapping)
gcloud beta run domain-mappings create \
  --service devstudio \
  --domain devstudio.bugunai.com \
  --project dernektebugun-492221 \
  --region europe-west1
```
