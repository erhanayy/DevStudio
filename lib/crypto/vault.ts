import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getMasterKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    // 32-byte hex fallback if not explicitly set
    return crypto.createHash("sha256").update(process.env.AUTH_SECRET || "devstudio_default_secret_key").digest();
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plainText: string): {
  encryptedKey: string;
  iv: string;
  authTag: string;
} {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return {
    encryptedKey: encrypted,
    iv: iv.toString("hex"),
    authTag,
  };
}

export function decryptSecret(encryptedKey: string, iv: string, authTag: string): string {
  const masterKey = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(encryptedKey, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
