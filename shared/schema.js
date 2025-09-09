"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadRequestSchema = exports.insertDownloadSchema = exports.insertUserSchema = exports.downloads = exports.users = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_zod_1 = require("drizzle-zod");
const zod_1 = require("zod");
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    username: (0, pg_core_1.text)("username").notNull().unique(),
    password: (0, pg_core_1.text)("password").notNull(),
});
exports.downloads = (0, pg_core_1.pgTable)("downloads", {
    id: (0, pg_core_1.varchar)("id").primaryKey().default((0, drizzle_orm_1.sql) `gen_random_uuid()`),
    url: (0, pg_core_1.text)("url").notNull(),
    title: (0, pg_core_1.text)("title").notNull(),
    thumbnail: (0, pg_core_1.text)("thumbnail"),
    duration: (0, pg_core_1.text)("duration"),
    channel: (0, pg_core_1.text)("channel"),
    views: (0, pg_core_1.text)("views"),
    quality: (0, pg_core_1.text)("quality").notNull(),
    format: (0, pg_core_1.text)("format").notNull(),
    filename: (0, pg_core_1.text)("filename").notNull(),
    fileSize: (0, pg_core_1.integer)("file_size"),
    status: (0, pg_core_1.text)("status").notNull().default("pending"), // pending, downloading, completed, failed
    progress: (0, pg_core_1.integer)("progress").default(0),
    downloadSpeed: (0, pg_core_1.text)("download_speed"),
    timeRemaining: (0, pg_core_1.text)("time_remaining"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
});
exports.insertUserSchema = (0, drizzle_zod_1.createInsertSchema)(exports.users).pick({
    username: true,
    password: true,
});
exports.insertDownloadSchema = (0, drizzle_zod_1.createInsertSchema)(exports.downloads).pick({
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
exports.downloadRequestSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    quality: zod_1.z.enum(["1080p", "720p", "480p", "360p"]),
    format: zod_1.z.enum(["mp4", "webm", "mp3", "wav"]),
});
