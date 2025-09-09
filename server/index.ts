import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { log } from "./vite";

const app = express();

// Lightweight liveness probe for Railway healthchecks
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json.bind(res) as (body?: any) => Response;
  (res as any).json = (bodyJson?: any): Response => {
    capturedJsonResponse = bodyJson as any;
    return originalResJson(bodyJson);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        } catch {}
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Start server immediately to respond to healthchecks
  const port = parseInt(process.env.PORT || '5000', 10);
  const server = app.listen(port, "0.0.0.0", () => {
    log(`serving on http://0.0.0.0:${port}`);
  });

  // Register routes asynchronously after server is listening
   try {
     await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      const { setupVite } = await import("./vite");
      await setupVite(app, server);
    } else {
      const { serveStatic } = await import("./vite");
      serveStatic(app);
    }

    log("Application fully initialized");
  } catch (error) {
    log(`Failed to initialize application: ${error}`);
    process.exit(1);
  }
})();
