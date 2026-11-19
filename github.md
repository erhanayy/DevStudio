# DevStudio - GitHub Gönderim Tarihçesi (github.md)

Bu dokümanda DevStudio projesinin Git/GitHub gönderim tarihçesi tutulacaktır. Kural 2 uyarınca kullanıcı onayı olmadan push yapılamaz.

| Tarih | Commit Özeti | Dal (Branch) | Onaylayan | Notlar |
| :--- | :--- | :--- | :--- | :--- |
| 2026-11-19 | **🏷️ Tag / Label:** `pre-local-cli-v2.3.0` (`b29f5fd`) | `main` (Tag) | Erhan Ayyıldız | Madde 22 (Mac + Windows Çapraz Platform Yerel CLI Runner & Kurulum Rehberi) geliştirmesi öncesi güvenli geri dönüş etiketi. |
| 2026-11-19 | **🏷️ Tag / Label:** `v2.3.0-stable` (`b53d9f7`) | `main` (Tag) | Erhan Ayyıldız | Ürünleştirme fazına geçmeden önce çalışan son kararlı sürüm (Cloud Run `devstudio-00025-cfj`) güvenli geri dönüş noktası olarak etiketlendi. |
| 2026-11-19 | `feat(chat): dynamic approval card status headers and one-tap copy button for AI/runner messages` (`2353870`) | `main` | Erhan Ayyıldız | Kullanıcı onayıyla: Madde 19 (`ApprovalCard` dinamik durum başlığı, ikon ve kenarlık renkleri) ve Madde 20 (AI/Runner mesajları için mobil-first 44px Kopyala butonu) canlıya (`devstudio-00025-cfj`) alındı. |
| 2026-11-19 | `fix(ai): integrate gemini-3-flash-preview, extend timeout to 12s, remove deceptive fallback loop` (`304b777`) | `main` | Erhan Ayyıldız | Kullanıcı onayıyla: gemini-3-flash-preview (5s, kararlı) öncelikli model yapıldı, zaman aşımı 12s'ye dengelendi ve yanıltıcı acil durum şablonu düzeltildi. |
| 2026-11-19 | `fix(ai): add fast fallback, reduce model timeout to 7s to prevent mobile connection drop` (`f0565f6`) | `main` | Erhan Ayyıldız | Kullanıcı onayıyla: Model deneme süresi 7s'ye düşürüldü, gemini-3.1-flash-lite (1.8s) acil kurtarma modeli olarak 2. sıraya yerleştirildi, mobil bağlantı kopması önlendi. |
| 2026-11-19 | `feat(ai): integrate gemini-3.8-flash as primary model with resilient multi-tier fallback` (`5ea94d4`) | `main` | Erhan Ayyıldız | Kullanıcı onayıyla: Gemini 3.8 Flash amiral gemisi model entegre edildi, 3.8 engeli kaldırıldı, 3.5/3.1 dinamik yedekleme zinciri ve arayüz seçicisi eklendi. |
| 2026-11-19 | `fix(mobile): optimize cockpit bar, prevent menu icon overlap, and enforce zero-horizontal-scroll` (`b4368f1`) | `main` | Erhan Ayyıldız | Kullanıcı onayıyla: Sol menü butonunun ezilmesi engellendi, model seçici sadeleştirildi ve sıfır yatay kaydırma garantisi sağlandı. |
| 2026-11-18 | `fix(prompt): add document append safeguard to prevent truncating Analysis.md and docs` (`abcc42b`) | `main` | Erhan Ayyıldız | Asistanın Analysis.md ve dokümanların üzerine yazmasını engelleyen Kural 4 entegre edildi. Cloud Run revizyonu: devstudio-00013-ljc. |
| 2026-11-18 | `docs(agents): add multi-project documentation isolation rule` (`80b8e1b`) | `main` | Erhan Ayyıldız | Çoklu proje dokümantasyon izolasyon kuralı eklendi. |
| 2026-11-18 | `docs: import architectural analysis sections 8-14 and complete deployment log from session` (`33c5da5`) | `main` | Erhan Ayyıldız | Kullanıcının onayıyla: TatildeBugun kütüğünden DevStudio mimari analizleri (Madde 8-14) ve Cloud Run dağıtım geçmişi DevStudio deposuna aktarıldı. |
| 2026-11-18 | `fix(chat): migrate approval actions and status polling to permanent REST endpoints` (`1f33945`) | `main` | Erhan Ayyıldız | Server Action hash geçersizleşmesi ("Failed to find Server Action") kalıcı REST mimarisi ile çözüldü. |
| 2026-11-18 | `docs(roadmap): add custom domain integration milestone for devstudio.bugunai.com` (`ab90c8c`) | `main` | Erhan Ayyıldız | Mac Runner daemon tarafından yürütülen Roadmap.md oluşturma komutu. |
| 2026-11-18 | `fix(chat): extend approval poller timeout to 10m and add resilient background listener` (`9584619`) | `main` | Erhan Ayyıldız | 120s polling timeout 600s seviyesine yükseltildi, kalıcı useEffect reaktif dinleyicisi eklendi. |
| 2026-11-18 | `fix(chat): join all Gemini candidate parts to eliminate cut-offs and lock viewport height` (`bc89732`) | `main` | Erhan Ayyıldız | extractGeminiText ile çok parçalı Gemini yanıtlarının birleştirilmesi ve 100dvh kilitli mobil sohbet penceresi. |
| 2026-11-17 | `feat: initial release of DevStudio mobile AI engineer cockpit` | `main` | Erhan Ayyıldız | Kullanıcı onayıyla repo oluşturuldu ve ilk sürüm gönderildi. |
| 2026-11-17 | `init: project architecture, AGENTS.md, Security.md, Analysis.md` | `main` | Erhan Ayyıldız | DevStudio mimari ve planlama dokümanları başlatıldı. |
