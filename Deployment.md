# DevStudio - Dağıtım Yönetimi (Deployment.md)

Bu dokümanda DevStudio platformunun bulut dağıtım adımları ve geçmişi kayıt altına alınacaktır. Kural 3 uyarınca kullanıcı onayı olmadan dağıtım yapılamaz.

## Dağıtım Geçmişi

| Sürüm | Tarih | Ortam | Değişiklik Özeti | Durum |
| :--- | :--- | :--- | :--- | :--- |
| v1.2.0 | 2026-11-18 | Production (`europe-west1`) | Gerçek Yapay Zeka (Gemini API) beyin entegrasyonu, gerçek onay döngüsü (polling), Mac Runner yerel komut icrası ve canlı terminal çıktısı | Dağıtımda / Yayında |
| v1.1.0 | 2026-11-18 | Production (`europe-west1`) | DevStudio'nun kendi kendini geliştirmesi (Dogfooding): Projeler listesine DevStudio eklendi, `/api/runner` senkronizasyon ve canlı heartbeat köprüsü entegre edildi, runner-client çoklu proje desteği kazandı | Dağıtımda / Yayında |
| v1.0.0 | 2026-11-17 | Production (`devstudio.bugunai.com`) | İlk Canlı Yayın: Google Cloud Run (`europe-west1`), NextAuth v5 kimlik doğrulama, Cloud SQL PostgreSQL (`devstudio`), AES-256 Vault, Çift Dilli i18n, Mobil-First Chat & İnteraktif Onay Kartları | Dağıtımda / Yayında |
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
