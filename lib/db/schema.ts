import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

// 1. Kullanıcılar
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }).unique(),
  password: text("password").notNull(),
  fullName: varchar("full_name", { length: 150 }).notNull(),
  username: varchar("username", { length: 50 }).unique(),
  avatarUrl: text("avatar_url"),
  role: varchar("role", { length: 20 }).default("developer").notNull(), // 'admin', 'developer', 'user'
  status: varchar("status", { length: 20 }).default("active").notNull(), // 'active', 'suspended'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. Yasal Sözleşmeler (KVKK, Hizmet Sözleşmesi, Gizlilik)
export const agreements = pgTable("agreements", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 50 }).notNull(), // 'kvkk', 'terms', 'privacy'
  version: varchar("version", { length: 20 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userAgreements = pgTable("user_agreements", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  agreementId: uuid("agreement_id")
    .references(() => agreements.id, { onDelete: "cascade" })
    .notNull(),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
});

// 3. Projeler / Çalışma Alanları (AllTripX, BurstaBugun vb.)
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  localPath: text("local_path").notNull(), // Örn: /Users/erhanayyildiz/Desktop/Work/TatildeBugun
  repoUrl: text("repo_url"), // GitHub repo linki
  deployType: varchar("deploy_type", { length: 50 }).default("cloudrun").notNull(), // 'cloudrun', 'vercel', 'none'
  deployCommand: text("deploy_command"), // Dağıtım komutu
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 4. API Anahtarları Kasası (AES-256-GCM Şifreli BYOK)
export const userApiKeys = pgTable("user_api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  provider: varchar("provider", { length: 50 }).notNull(), // 'gemini', 'anthropic', 'openai'
  encryptedKey: text("encrypted_key").notNull(),
  iv: varchar("iv", { length: 64 }).notNull(),
  authTag: varchar("auth_tag", { length: 64 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 5. Runner Eşleşme Anahtarları (Pairing Tokens)
export const runnerTokens = pgTable("runner_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  deviceName: varchar("device_name", { length: 100 }).default("My Computer").notNull(),
  isOnline: boolean("is_online").default(false).notNull(),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 6. Chat Oturumları (Geliştirme Sohbeti)
export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  title: varchar("title", { length: 200 }).default("Yeni Geliştirme").notNull(),
  model: varchar("model", { length: 100 }).default("gemini-2.0-flash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 7. Chat Mesajları
export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .references(() => chatSessions.id, { onDelete: "cascade" })
    .notNull(),
  role: varchar("role", { length: 20 }).notNull(), // 'user', 'assistant', 'system', 'runner'
  content: text("content").notNull(),
  attachments: jsonb("attachments").default([]).notNull(), // Fotoğraf / ekran görüntüsü URL'leri
  toolCalls: jsonb("tool_calls").default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 8. İnteraktif Onaylar (In-Chat Approval Requests)
export const approvals = pgTable("approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .references(() => chatSessions.id, { onDelete: "cascade" })
    .notNull(),
  command: text("command").notNull(),
  description: text("description").notNull(),
  riskLevel: varchar("risk_level", { length: 20 }).default("medium").notNull(), // 'low', 'medium', 'high', 'critical'
  status: varchar("status", { length: 20 }).default("pending").notNull(), // 'pending', 'approved', 'rejected'
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
