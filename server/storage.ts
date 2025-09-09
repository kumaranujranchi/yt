import { type User, type InsertUser, type Download, type InsertDownload } from "@shared/schema";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { users, downloads } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getDownloads(): Promise<Download[]>;
  getDownload(id: string): Promise<Download | undefined>;
  createDownload(download: InsertDownload): Promise<Download>;
  updateDownload(id: string, updates: Partial<Download>): Promise<Download | undefined>;
  deleteDownload(id: string): Promise<boolean>;
}

class DatabaseStorage implements IStorage {
  private db;

  constructor() {
    const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    const sql = neon(connectionString);
    this.db = drizzle(sql);
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await this.db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getDownloads(): Promise<Download[]> {
    const result = await this.db.select().from(downloads).orderBy(desc(downloads.createdAt));
    return result;
  }

  async getDownload(id: string): Promise<Download | undefined> {
    const result = await this.db.select().from(downloads).where(eq(downloads.id, id));
    return result[0];
  }

  async createDownload(insertDownload: InsertDownload): Promise<Download> {
    const result = await this.db.insert(downloads).values({
      ...insertDownload,
      status: "pending",
      progress: 0,
      createdAt: new Date(),
      completedAt: null,
      fileSize: null,
      downloadSpeed: null,
      timeRemaining: null,
    }).returning();
    return result[0];
  }

  async updateDownload(id: string, updates: Partial<Download>): Promise<Download | undefined> {
    const result = await this.db.update(downloads)
      .set(updates)
      .where(eq(downloads.id, id))
      .returning();
    return result[0];
  }

  async deleteDownload(id: string): Promise<boolean> {
    const result = await this.db.delete(downloads).where(eq(downloads.id, id));
    return result.rowCount > 0;
  }
}

// Fallback to memory storage if database is not available
class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private downloads: Map<string, Download> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = crypto.randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getDownloads(): Promise<Download[]> {
    return Array.from(this.downloads.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async getDownload(id: string): Promise<Download | undefined> {
    return this.downloads.get(id);
  }

  async createDownload(insertDownload: InsertDownload): Promise<Download> {
    const id = crypto.randomUUID();
    const download: Download = {
      ...insertDownload,
      id,
      status: "pending",
      progress: 0,
      createdAt: new Date(),
      completedAt: null,
      fileSize: null,
      downloadSpeed: null,
      timeRemaining: null,
      thumbnail: insertDownload.thumbnail ?? null,
      duration: insertDownload.duration ?? null,
      channel: insertDownload.channel ?? null,
      views: insertDownload.views ?? null,
    };
    this.downloads.set(id, download);
    return download;
  }

  async updateDownload(id: string, updates: Partial<Download>): Promise<Download | undefined> {
    const download = this.downloads.get(id);
    if (!download) return undefined;
    
    const updated = { ...download, ...updates };
    this.downloads.set(id, updated);
    return updated;
  }

  async deleteDownload(id: string): Promise<boolean> {
    return this.downloads.delete(id);
  }
}

// Use database storage if DATABASE_URL is available, otherwise fall back to memory storage
let storageInstance: IStorage;
try {
  const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (connectionString) {
    storageInstance = new DatabaseStorage();
    console.log("✅ Using database storage (PostgreSQL with Neon)");
  } else {
    storageInstance = new MemStorage();
    console.log("✅ Using in-memory storage (no DATABASE_URL provided)");
  }
} catch (error) {
  console.warn("⚠️ Database connection failed, falling back to in-memory storage:", error);
  storageInstance = new MemStorage();
}

export const storage = storageInstance;
