# DevStudio - Dağıtım Yönetimi (Deployment.md)

Bu dokümanda DevStudio platformunun bulut dağıtım adımları ve geçmişi kayıt altına alınacaktır. Kural 3 uyarınca kullanıcı onayı olmadan dağıtım yapılamaz.

## Dağıtım Geçmişi

| Sürüm | Tarih | Ortam | Değişiklik Özeti | Durum |
| :--- | :--- | :--- | :--- | :--- |
| v1.8.0 | 2026-11-18 | Production (`europe-west1`) | Doküman Koruma Güvenlik Duvarı: Asistanın prompt kurallarına `Analysis.md`, `Deployment.md` ve doküman dosyalarını baştan sıfırlayarak ('>') yazmasını engelleyen, her zaman sonuna ekleme ('>>') yapmasını zorunlu kılan Kural 4 eklendi | Canlıda & Aktif (`devstudio-00013-ljc`) |
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
