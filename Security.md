# DevStudio - Güvenlik ve İzolasyon Standartları (Security.md)

1. **AES-256-GCM Vault Şifreleme:** Kullanıcıların girdiği Google AI Studio, Anthropic veya OpenAI API anahtarları veritabanında şifreli saklanır.
2. **WebSocket Kimlik Doğrulaması:** Mac/Windows Runner cihazları, sadece kullanıcıya ait eşleşme token'ı (Pairing Token) doğrulanırsa buluta bağlanabilir.
3. **Komut İzolasyonu & Güvenli Yürütme:** Kullanıcının bilgisayarında çalıştırılacak komutlar, kullanıcının belirlediği proje kök dizini dışına çıkamaz.
4. **Sıfır PII ve Maskeleme:** Loglarda kullanıcı şifreleri veya API anahtarları asla yer almaz.
