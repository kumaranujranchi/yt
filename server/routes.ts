import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { downloadRequestSchema, insertDownloadSchema } from "@shared/schema";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create downloads directory if it doesn't exist
  const downloadsDir = path.join(process.cwd(), "downloads");
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

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

      // Use yt-dlp to get video info
      const ytDlp = spawn("yt-dlp", [
        "--dump-json",
        "--no-download",
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

      ytDlp.on("close", (code) => {
        if (code !== 0) {
          console.error("yt-dlp error:", error);
          return res.status(400).json({ message: "Failed to fetch video information" });
        }

        try {
          const videoInfo = JSON.parse(output);
          res.json({
            title: videoInfo.title || "Unknown Title",
            thumbnail: videoInfo.thumbnail || "",
            duration: formatDuration(videoInfo.duration) || "Unknown",
            channel: videoInfo.uploader || "Unknown Channel",
            views: formatViews(videoInfo.view_count) || "Unknown",
          });
        } catch (parseError) {
          console.error("Parse error:", parseError);
          res.status(500).json({ message: "Failed to parse video information" });
        }
      });
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
      
      // Get video info first
      const infoResponse = await fetch(`http://localhost:${process.env.PORT || 5000}/api/video-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!infoResponse.ok) {
        return res.status(400).json({ message: "Failed to get video information" });
      }

      const videoInfo = await infoResponse.json();
      
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
      console.error("Download error:", error);
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

async function startDownload(downloadId: string, url: string, quality: string, format: string, filename: string) {
  try {
    const downloadsDir = path.join(process.cwd(), "downloads");
    const outputPath = path.join(downloadsDir, filename);

    // Update status to downloading
    await storage.updateDownload(downloadId, { status: "downloading" });

    // Determine yt-dlp format string
    let formatString = "best";
    if (format === "mp3") {
      formatString = "bestaudio/best";
    } else if (format === "wav") {
      formatString = "bestaudio/best";
    } else {
      // Video formats
      if (quality === "1080p") formatString = "best[height<=1080]";
      else if (quality === "720p") formatString = "best[height<=720]";
      else if (quality === "480p") formatString = "best[height<=480]";
      else if (quality === "360p") formatString = "best[height<=360]";
    }

    const args = [
      "--format", formatString,
      "--output", outputPath,
      url
    ];

    // Add audio extraction for audio-only formats
    if (format === "mp3") {
      args.push("--extract-audio", "--audio-format", "mp3");
    } else if (format === "wav") {
      args.push("--extract-audio", "--audio-format", "wav");
    }

    const ytDlp = spawn("yt-dlp", args);

    let error = "";

    ytDlp.stderr.on("data", (data) => {
      const output = data.toString();
      error += output;
      
      // Parse progress from yt-dlp output
      const progressMatch = output.match(/(\d+(?:\.\d+)?)%/);
      if (progressMatch) {
        const progress = Math.round(parseFloat(progressMatch[1]));
        storage.updateDownload(downloadId, { progress });
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
      } else {
        console.error("yt-dlp failed:", error);
        await storage.updateDownload(downloadId, {
          status: "failed",
        });
      }
    });

  } catch (error) {
    console.error("Download process error:", error);
    await storage.updateDownload(downloadId, { status: "failed" });
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
