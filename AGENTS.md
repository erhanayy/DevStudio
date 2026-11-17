# DevStudio - Antigravity Proje Kuralları (AGENTS.md)

Bu dosya, DevStudio projesinde çalışan yapay zeka asistanının ve geliştirme araçlarının UYMASI ZORUNLU temel kurallarını içerir.

---

## 1. Analiz ve Değişiklik Takibi
- Yapılan tüm analizler, mimari kararlar ve değişiklikler Analysis.md içerisine başlıklar halinde detaylıca işlenecektir.

## 2. GitHub Gönderim Disiplini
- GitHub'a veya uzak depoya kod gönderimi (push) ASLA otomatik olarak yapılamaz.
- Yalnızca kullanıcının açık komutu ile gönderim yapılacak ve detaylar github.md dosyasına kaydedilecektir.

## 3. Dağıtım (Deployment) Disiplini
- Dağıtım (Deployment) işlemleri ASLA otomatik olarak yapılamaz.
- Yalnızca kullanıcının açık komutu ile dağıtım yapılacak ve süreç bilgileri Deployment.md dosyasına yazılacaktır.

## 4. Onay Öncesi Kod Geliştirme Yasağı
- Yeni bir özellik veya modül geliştirilirken hemen kodlamaya başlanmayacaktır.
- Önce analiz, mimari ve arayüz/servis tasarımı sunulacaktır.
- Yalnızca kullanıcıdan "Onaylıyorum, Geliştirmeyi Yapabilirsin" komutu/onayı geldikten sonra kod yazımına geçilecektir.

## 5. Dizin İzolasyonu ve Güvenlik
- Projenin güvenlik kuralları Security.md dosyasında tutulacaktır.
- Proje ana dizini (/Users/erhanayyildiz/Desktop/Work/DevStudio) dışında yapılacak HER İŞLEM İÇİN kullanıcıya açıkça sorulacak ve kesin onay alınacaktır.

## 6. Geliştirme Ortamı ve Mimari Uyumu
- Geliştirme ortamı, kütüphane altyapısı ve mimari AllTripX ve BurstaBugun projeleri ile tam uyumlu (Next.js 16, React 19, Tailwind v4, Drizzle ORM, NextAuth v5) olacaktır.

## 7. Şifreli Gizli Bilgi Yönetimi
- Kullanıcıların AI sağlayıcı API anahtarları ve bağlantı token'ları AES-256-GCM ile şifrelenmiş biçimde saklanacaktır. Asla düz metin (plaintext) tutulamaz veya loglanamaz.

## 8. Mobil-First ve Sıfır Yatay Kaydırma Disiplini (Strict Mobile-First & Zero-Horizontal-Scroll)
- Projedeki tüm ekranlar (özellikle Chat, Onay Kartları ve Kod Diff'leri) öncelikli olarak mobil ekranlarda (360px - 430px) kusursuz çalışacak şekilde tasarlanacaktır.
- Yatay kaydırma çubuğu kesinlikle kullanılmayacaktır; dokunma hedefleri minimum 44px olacaktır.
