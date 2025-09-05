import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const downloads = pgTable("downloads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  title: text("title").notNull(),
  thumbnail: text("thumbnail"),
  duration: text("duration"),
  channel: text("channel"),
  views: text("views"),
  quality: text("quality").notNull(),
  format: text("format").notNull(),
  filename: text("filename").notNull(),
  fileSize: integer("file_size"),
  status: text("status").notNull().default("pending"), // pending, downloading, completed, failed
  progress: integer("progress").default(0),
  downloadSpeed: text("download_speed"),
  timeRemaining: text("time_remaining"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertDownloadSchema = createInsertSchema(downloads).pick({
  url: true,
  title: true,
  thumbnail: true,
  duration: true,
  channel: true,
  views: true,
  quality: true,
  format: true,
  filename: true,
});

export const downloadRequestSchema = z.object({
  url: z.string().url(),
  quality: z.enum(["1080p", "720p", "480p", "360p"]),
  format: z.enum(["mp4", "webm", "mp3", "wav"]),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertDownload = z.infer<typeof insertDownloadSchema>;
export type Download = typeof downloads.$inferSelect;
export type DownloadRequest = z.infer<typeof downloadRequestSchema>;
