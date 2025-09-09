import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { downloadRequestSchema, insertDownloadSchema } from "@shared/schema";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { logger } from "./utils/logger";
import { ValidationError, DownloadError, NotFoundError, errorHandler } from "./utils/errors";

// Add preflight binary checks
let HAS_YTDLP = false;
let HAS_FFMPEG = false;

async function checkBinaryExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const p = spawn(cmd, ["--version"], { stdio: 'pipe' });
      const timer = setTimeout(() => {
        try { p.kill('SIGTERM'); } catch {}
        resolve(false);
      }, 6000);
      
      let hasOutput = false;
      p.stdout?.on('data', () => { hasOutput = true; });
      
      p.on("error", (err) => { 
        clearTimeout(timer); 
        logger.debug(`Binary check error for ${cmd}:`, { error: err.message });
        resolve(false); 
      });
      
      p.on("close", (code) => { 
        clearTimeout(timer); 
        const success = code === 0 || hasOutput;
        logger.debug(`Binary check for ${cmd}:`, { code, hasOutput, success });
        resolve(success); 
      });
    } catch (err) {
      logger.debug(`Binary check exception for ${cmd}:`, { error: err instanceof Error ? err.message : String(err) });
      resolve(false);
    }
  });
}

// Request logging middleware
const logRequest = (req: any, _res: any, next: any) => {
  logger.info(`${req.method} ${req.path}`, { 
    ip: req.ip, 
    userAgent: req.get('User-Agent'),
    body: req.method !== 'GET' ? req.body : undefined
  });
  next();
};

// Dynamically re-check tools when missing to allow self-heal without restart
async function ensureTools(): Promise<{ ytdlp: boolean; ffmpeg: boolean }> {
  if (!HAS_YTDLP) {
    HAS_YTDLP = await checkBinaryExists("yt-dlp");
    if (HAS_YTDLP) logger.info("yt-dlp is now available after re-check");
  }
  if (!HAS_FFMPEG) {
    HAS_FFMPEG = await checkBinaryExists("ffmpeg");
    if (HAS_FFMPEG) logger.info("ffmpeg is now available after re-check");
  }
  return { ytdlp: HAS_YTDLP, ffmpeg: HAS_FFMPEG };
}

// Extract video info logic into reusable function
async function getVideoInfo(url: string): Promise<any | null> {
  return new Promise((resolve) => {
    if (!url || typeof url !== "string") {
      resolve({ success: false, errorType: "invalid_url", message: "URL is required" });
      return;
    }

    // Validate YouTube URL
    const youtubeUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    if (!youtubeUrlPattern.test(url)) {
      resolve({ success: false, errorType: "invalid_url", message: "Invalid YouTube URL" });
      return;
    }

    // Use yt-dlp to get video info (avoid probing formats to prevent 403 on Shorts)
    const ytDlp = spawn("yt-dlp", [
      "--dump-json",
      "--no-download",
      "--no-check-formats",
      "-i", // ignore errors but still try to output metadata
      "--force-ipv4",
      "--geo-bypass",
      "--no-warnings",
      url
    ]);

    let output = "";
    let error = "";

    ytDlp.stdout.on("data", (data) => {
      output += data.toString();
    });

    ytDlp.stderr.on("data", (data) => {
      error += data.toString();
    });

    // NEW: handle spawn error (e.g., ENOENT when yt-dlp is missing)
    ytDlp.on("error", (err) => {
      logger.error("yt-dlp spawn error", { error: err instanceof Error ? err.message : String(err) });
      resolve({ success: false, errorType: "missing_binary", message: "yt-dlp is not available on the server." });
    });

    ytDlp.on("close", (code) => {
      if (code !== 0 && !output) {
        // Log more specific error information
        let errorType = "unknown";
        let message = "Failed to fetch video information";
        if (error.includes("HTTP Error 403")) {
          errorType = "forbidden";
          message = "YouTube blocked format probing. Please try again or choose a different quality.";
        } else if (error.includes("Video unavailable")) {
          errorType = "video_unavailable";
          message = "This video is unavailable. It may have been deleted, made private, or restricted in your region.";
        } else if (error.includes("Private video")) {
          errorType = "private_video";
          message = "This is a private video. You don't have permission to access it.";
        } else if (error.includes("This video is not available")) {
          errorType = "region_restricted";
          message = "This video is not available in your region.";
        }
        
        logger.error("yt-dlp error", { error, errorType, url });
        resolve({ success: false, errorType, message });
        return;
      }

      try {
        const videoInfo = JSON.parse(output);
        resolve({
          success: true,
          data: {
            title: videoInfo.title || "Unknown Title",
            thumbnail: videoInfo.thumbnail || "",
            duration: formatDuration(videoInfo.duration) || "Unknown",
            channel: videoInfo.uploader || "Unknown Channel",
            views: formatViews(videoInfo.view_count) || "Unknown",
          }
        });
      } catch (parseError) {
         logger.error("Parse error", { error: parseError instanceof Error ? parseError.message : String(parseError) });
         resolve({ success: false, errorType: "parse_error", message: "Failed to parse video information" });
       }
    });
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Create downloads directory if it doesn't exist
  const downloadsDir = path.join(process.cwd(), "downloads");
  const logsDir = path.join(process.cwd(), "logs");
  
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
    logger.info("Created downloads directory", { path: downloadsDir });
  }
  
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    logger.info("Created logs directory", { path: logsDir });
  }

  // Preflight: check for required binaries at startup
  HAS_YTDLP = await checkBinaryExists("yt-dlp");
  HAS_FFMPEG = await checkBinaryExists("ffmpeg");
  if (!HAS_YTDLP) {
    logger.error("yt-dlp binary not found. Ensure it is installed and on PATH.");
  }
  if (!HAS_FFMPEG) {
    logger.warn("ffmpeg binary not found. Audio extraction and merging will fail.");
  }

  // Apply logging middleware to all routes
  app.use(logRequest);

  // Health endpoint to observe tool availability remotely
  app.get("/api/health", async (_req, res) => {
    try {
      const tools = await ensureTools();
      return res.json({
        status: tools.ytdlp ? (tools.ffmpeg ? "ok" : "degraded") : "down",
        hasYtDlp: tools.ytdlp,
        hasFfmpeg: tools.ffmpeg,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      logger.error("Health check error", { error: e instanceof Error ? e.message : String(e) });
      return res.json({ status: "error", message: "health check failed" });
    }
  });

  // Get video info from YouTube URL
  app.post("/api/video-info", async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "URL is required" });
      }

      // Validate YouTube URL
      const youtubeUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
      if (!youtubeUrlPattern.test(url)) {
        return res.status(400).json({ message: "Invalid YouTube URL" });
      }

      // Preflight (with dynamic re-check)
      const tools = await ensureTools();
      if (!tools.ytdlp) {
        return res.status(503).json({ message: "Server tools are initializing or missing (yt-dlp). Please try again shortly." });
      }

      const infoResult = await getVideoInfo(url);
      if (!infoResult || (infoResult as any).success !== true) {
        const message = (infoResult as any)?.message ?? "Failed to get video information";
        const errorType = (infoResult as any)?.errorType ?? "unknown";
        return res.status(400).json({ message, errorType });
      }

      const videoInfo = (infoResult as any).data;
      return res.json(videoInfo);
    } catch (error) {
      console.error("Video info error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Start download
  app.post("/api/download", async (req, res) => {
    try {
      const validatedData = downloadRequestSchema.parse(req.body);

      // First get video info
      const { url, quality, format } = validatedData;
      
      // Preflight: ensure tools exist (with dynamic re-check)
      const tools = await ensureTools();
      if (!tools.ytdlp) {
        return res.status(503).json({ message: "Server tools are initializing or missing (yt-dlp). Please try again shortly." });
      }
      
      // Check if ffmpeg is required for this specific download
      const requiresFFmpeg = format === "mp3" || format === "wav";
      if (requiresFFmpeg && !tools.ffmpeg) {
        return res.status(503).json({ message: "FFmpeg is required for audio downloads but not available. Please try a video format instead." });
      }
      
      // Get video info directly instead of making a self-referencing fetch
      const infoResult = await getVideoInfo(url);

      if (!infoResult || (infoResult as any).success !== true) {
        const message = (infoResult as any)?.message ?? "Failed to get video information";
        const errorType = (infoResult as any)?.errorType ?? "unknown";
        logger.warn("Download prevented due to video info error", { url, errorType, message });
        return res.status(400).json({ message, errorType });
      }

      const videoInfo = (infoResult as any).data;
      
      // Create download record
      const filename = `${sanitizeFilename(videoInfo.title)}.${format}`;
      const downloadData = {
        url,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        duration: videoInfo.duration,
        channel: videoInfo.channel,
        views: videoInfo.views,
        quality,
        format,
        filename,
      };

      const download = await storage.createDownload(downloadData);
      
      // Start the download process asynchronously
      startDownload(download.id, url, quality, format, filename);
      
      res.json(download);
    } catch (error) {
      logger.error("Download error", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to start download" });
    }
  });

  // Get all downloads
  app.get("/api/downloads", async (req, res) => {
    try {
      const downloads = await storage.getDownloads();
      res.json(downloads);
    } catch (error) {
      console.error("Get downloads error:", error);
      res.status(500).json({ message: "Failed to get downloads" });
    }
  });

  // Get download by ID
  app.get("/api/downloads/:id", async (req, res) => {
    try {
      const download = await storage.getDownload(req.params.id);
      if (!download) {
        return res.status(404).json({ message: "Download not found" });
      }
      res.json(download);
    } catch (error) {
      console.error("Get download error:", error);
      res.status(500).json({ message: "Failed to get download" });
    }
  });

  // Delete download
  app.delete("/api/downloads/:id", async (req, res) => {
    try {
      const download = await storage.getDownload(req.params.id);
      if (!download) {
        return res.status(404).json({ message: "Download not found" });
      }

      // Delete file if it exists
      const filePath = path.join(downloadsDir, download.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      const deleted = await storage.deleteDownload(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Download not found" });
      }

      res.json({ message: "Download deleted successfully" });
    } catch (error) {
      console.error("Delete download error:", error);
      res.status(500).json({ message: "Failed to delete download" });
    }
  });

  // Serve downloaded files
  app.get("/api/downloads/:id/file", async (req, res) => {
    try {
      const download = await storage.getDownload(req.params.id);
      if (!download || download.status !== "completed") {
        return res.status(404).json({ message: "File not found" });
      }

      const filePath = path.join(downloadsDir, download.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      res.download(filePath, download.filename);
    } catch (error) {
      console.error("Serve file error:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Download queue management
const downloadQueue: string[] = [];
let isProcessing = false;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

async function startDownload(downloadId: string, downloadUrl: string, downloadQuality: string, downloadFormat: string, filename: string) {
  // Add to queue instead of starting immediately
  downloadQueue.push(downloadId);
  logger.info("Download queued", { downloadId, queueLength: downloadQueue.length });
  
  // Process queue if not already processing
  if (!isProcessing) {
    processDownloadQueue();
  }
}

async function processDownloadQueue() {
  if (isProcessing || downloadQueue.length === 0) {
    return;
  }

  isProcessing = true;

  while (downloadQueue.length > 0) {
    const downloadId = downloadQueue.shift()!;
    await processDownload(downloadId);
    
    // Small delay between downloads
    if (downloadQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  isProcessing = false;
}

async function processDownload(downloadId: string) {
  const download = await storage.getDownload(downloadId);
  if (!download) {
    logger.error("Download not found for processing", { downloadId });
    return;
  }

  const { url: downloadUrl, quality: downloadQuality, format: downloadFormat, filename } = download;
  
  try {
    const downloadsDir = path.join(process.cwd(), "downloads");
    const outputPath = path.join(downloadsDir, filename);

    // Update status to downloading
    await storage.updateDownload(downloadId, { 
      status: "downloading",
      progress: 0
    });

    // Estimate file size before download
    const estimatedSize = await estimateFileSize(downloadUrl, downloadQuality, downloadFormat);
    if (estimatedSize) {
      await storage.updateDownload(downloadId, { fileSize: estimatedSize });
    }

    // Determine yt-dlp format string
    let formatString = "best";
    if (downloadFormat === "mp3") {
      formatString = "bestaudio/best";
    } else if (downloadFormat === "wav") {
      formatString = "bestaudio/best";
    } else {
      // Video formats: prefer separate video+audio with fallback to single-file best
      if (downloadQuality === "1080p") formatString = "bestvideo[height<=1080]+bestaudio/best[height<=1080]";
      else if (downloadQuality === "720p") formatString = "bestvideo[height<=720]+bestaudio/best[height<=720]";
      else if (downloadQuality === "480p") formatString = "bestvideo[height<=480]+bestaudio/best[height<=480]";
      else if (downloadQuality === "360p") formatString = "bestvideo[height<=360]+bestaudio/best[height<=360]";
    }

    const args = [
      "--format", formatString,
      "--output", outputPath,
      downloadUrl
    ];

    // For video outputs, ensure merged container matches requested format when possible
    if (downloadFormat === "mp4" || downloadFormat === "webm") {
      args.push("--merge-output-format", downloadFormat);
    }

    // Add audio extraction for audio-only formats
    if (downloadFormat === "mp3") {
      args.push("--extract-audio", "--audio-format", "mp3");
    } else if (downloadFormat === "wav") {
      args.push("--extract-audio", "--audio-format", "wav");
    }

    const ytDlp = spawn("yt-dlp", args);

    let error = "";
    let lastProgress = 0;

    ytDlp.stderr.on("data", (data) => {
      const output = data.toString();
      error += output;
      
      // Parse progress from yt-dlp output
      const progressMatch = output.match(/(\d+(?:\.\d+)?)%/);
      if (progressMatch) {
        const progress = Math.round(parseFloat(progressMatch[1]));
        if (progress !== lastProgress) {
          lastProgress = progress;
          storage.updateDownload(downloadId, { progress });
        }
      }

      // Parse download speed
      const speedMatch = output.match(/(\d+(?:\.\d+)?(?:K|M|G)?iB\/s)/);
      if (speedMatch) {
        storage.updateDownload(downloadId, { downloadSpeed: speedMatch[1] });
      }

      // Parse ETA
      const etaMatch = output.match(/ETA (\d+:\d+:\d+|\d+:\d+)/);
      if (etaMatch) {
        storage.updateDownload(downloadId, { timeRemaining: etaMatch[1] });
      }
    });

    ytDlp.on("close", async (code) => {
      if (code === 0) {
        // Get file size
        let fileSize = 0;
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          fileSize = stats.size;
        }

        await storage.updateDownload(downloadId, {
          status: "completed",
          progress: 100,
          fileSize,
          completedAt: new Date(),
        });
        logger.info("Download completed", { downloadId, fileSize });
      } else {
        logger.error("Download failed", { downloadId, error, code });
        
        // Mark as failed
        await storage.updateDownload(downloadId, {
          status: "failed",
        });
      }
    });

    ytDlp.on("error", async (error) => {
      logger.error("Download process error", { downloadId, error: error instanceof Error ? error.message : String(error) });
      await storage.updateDownload(downloadId, {
        status: "failed",
      });
    });

  } catch (error) {
    logger.error("Download process error", { downloadId, error: error instanceof Error ? error.message : String(error) });
    await storage.updateDownload(downloadId, { 
      status: "failed"
    });
  }
}

async function estimateFileSize(videoUrl: string, videoQuality: string, videoFormat: string): Promise<number | null> {
  try {
    return new Promise((resolve) => {
      const args = [
        "--dump-json",
        "--no-download",
        "--no-check-formats",
        "-i",
        "--force-ipv4",
        "--geo-bypass",
        "--no-warnings",
        videoUrl
      ];

      const ytDlp = spawn("yt-dlp", args);
      let output = "";

      ytDlp.stdout.on("data", (data) => {
        output += data.toString();
      });

      ytDlp.on("close", (code) => {
        if (code === 0 || output) {
          try {
            const info = JSON.parse(output);
            
            // Find appropriate format
            let targetFormat = info.formats?.find((f: any) => {
              if (videoFormat === "mp3" || videoFormat === "wav") {
                return f.acodec !== "none" && f.vcodec === "none";
              } else {
                const heightMatch = f.height?.toString() === videoQuality.replace("p", "");
                return heightMatch && f.acodec !== "none";
              }
            });

            if (!targetFormat && info.formats?.length > 0) {
              targetFormat = info.formats[info.formats.length - 1];
            }

            resolve(targetFormat?.filesize || info.filesize_approx || null);
          } catch (e) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });

      ytDlp.on("error", () => {
        resolve(null);
      });
    });
  } catch (error) {
    return null;
  }
}

function formatDuration(seconds: number): string {
  if (!seconds) return "Unknown";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatViews(views: number): string {
  if (!views) return "Unknown";
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9 \-_\.]/g, "").substring(0, 100);
}
