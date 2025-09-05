import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useEffect } from "react";

interface DownloadProgressProps {
  downloadId: string;
  onComplete: () => void;
}

export default function DownloadProgress({ downloadId, onComplete }: DownloadProgressProps) {
  const { data: download, isLoading } = useQuery({
    queryKey: ["/api/downloads", downloadId],
    refetchInterval: 1000, // Poll every second
    enabled: !!downloadId,
  });

  useEffect(() => {
    if (download && (download.status === "completed" || download.status === "failed")) {
      setTimeout(() => {
        onComplete();
      }, 2000); // Show completion status for 2 seconds
    }
  }, [download?.status, onComplete]);

  if (isLoading || !download || download.status === "pending") {
    return null;
  }

  if (download.status === "failed") {
    return (
      <Card className="shadow-lg border border-border mb-8" data-testid="card-download-failed">
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-destructive mb-2">Download Failed</h3>
            <p className="text-muted-foreground">
              The download could not be completed. Please try again.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progress = download.progress || 0;

  return (
    <Card className="shadow-lg border border-border mb-8" data-testid="card-download-progress">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-foreground">
            {download.status === "completed" ? "Download Complete!" : "Downloading..."}
          </h3>
          <div className="text-sm text-muted-foreground">
            <span data-testid="text-download-progress">{progress}</span>% Complete
          </div>
        </div>
        <Progress 
          value={progress} 
          className="mb-4"
          data-testid="progress-download"
        />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span data-testid="text-download-speed">
            {download.downloadSpeed || "Calculating..."}
          </span>
          <span data-testid="text-time-remaining">
            {download.status === "completed" 
              ? "Complete" 
              : download.timeRemaining || "Calculating time remaining..."
            }
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
