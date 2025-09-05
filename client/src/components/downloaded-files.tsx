import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Trash2, Video, Music, Inbox } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Download as DownloadType } from "@shared/schema";

export default function DownloadedFiles() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: downloads, isLoading } = useQuery<DownloadType[]>({
    queryKey: ["/api/downloads"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/downloads/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/downloads"] });
      toast({
        title: "File Deleted",
        description: "The downloaded file has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete the file. Please try again.",
        variant: "destructive",
      });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const completedDownloads = downloads?.filter(d => d.status === "completed") || [];
      await Promise.all(
        completedDownloads.map(download => 
          apiRequest("DELETE", `/api/downloads/${download.id}`)
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/downloads"] });
      toast({
        title: "All Files Cleared",
        description: "All downloaded files have been removed.",
      });
    },
  });

  const handleDownload = (downloadId: string) => {
    window.open(`/api/downloads/${downloadId}/file`, '_blank');
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "Unknown size";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Unknown";
    const now = new Date();
    const downloadDate = new Date(date);
    const diffMs = now.getTime() - downloadDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return "Less than an hour ago";
    }
  };

  const completedDownloads = downloads?.filter(d => d.status === "completed") || [];

  if (isLoading) {
    return (
      <Card className="shadow-lg border border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading downloads...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border border-border" data-testid="card-downloaded-files">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-foreground">Downloaded Files</h3>
          {completedDownloads.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending}
              className="text-sm text-primary hover:text-primary/80 font-medium"
              data-testid="button-clear-all"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All
            </Button>
          )}
        </div>

        {completedDownloads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="empty-downloads">
            <Inbox className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p>No downloaded files yet</p>
            <p className="text-sm">Your downloaded videos will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {completedDownloads.map((download) => (
              <div
                key={download.id}
                className="download-card flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30"
                data-testid={`card-download-${download.id}`}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-12 bg-primary/10 rounded-md flex items-center justify-center">
                    {download.format === "mp3" || download.format === "wav" ? (
                      <Music className="text-accent h-6 w-6" />
                    ) : (
                      <Video className="text-primary h-6 w-6" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground" data-testid={`text-filename-${download.id}`}>
                      {download.filename}
                    </h4>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span data-testid={`text-format-${download.id}`}>
                        {download.quality} • {download.format.toUpperCase()}
                      </span>
                      <span data-testid={`text-filesize-${download.id}`}>
                        {formatFileSize(download.fileSize || 0)}
                      </span>
                      <span data-testid={`text-date-${download.id}`}>
                        Downloaded {formatDate(download.completedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(download.id)}
                    className="p-2 text-primary hover:bg-primary/10 rounded-md transition-colors"
                    title="Download"
                    data-testid={`button-download-${download.id}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(download.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                    title="Delete"
                    data-testid={`button-delete-${download.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
