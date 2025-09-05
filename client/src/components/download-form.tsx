import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const formSchema = z.object({
  url: z.string().url("Please enter a valid URL").refine(
    (url) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(url),
    "Please enter a valid YouTube URL"
  ),
  quality: z.enum(["1080p", "720p", "480p", "360p"]),
  format: z.enum(["mp4", "webm", "mp3", "wav"]),
});

type FormData = z.infer<typeof formSchema>;

interface DownloadFormProps {
  onVideoInfo: (info: any) => void;
  onDownloadStart: (downloadId: string) => void;
}

export default function DownloadForm({ onVideoInfo, onDownloadStart }: DownloadFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [urlError, setUrlError] = useState("");
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
      quality: "720p",
      format: "mp4",
    },
  });

  const handleGetVideoInfo = async (url: string) => {
    try {
      const response = await apiRequest("POST", "/api/video-info", { url });
      const videoInfo = await response.json();
      onVideoInfo(videoInfo);
      setUrlError("");
      return videoInfo;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch video information";
      setUrlError(message);
      throw error;
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setUrlError("");

    try {
      // First get video info
      await handleGetVideoInfo(data.url);

      // Then start download
      const response = await apiRequest("POST", "/api/download", data);
      const download = await response.json();
      
      onDownloadStart(download.id);
      toast({
        title: "Download Started",
        description: "Your download has been queued and will begin shortly.",
      });

      // Reset form
      form.reset();
    } catch (error) {
      console.error("Download error:", error);
      const description = error instanceof Error ? error.message : "Failed to start download. Please check the URL and try again.";
      toast({
        title: "Download Failed",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="download-card shadow-lg border border-border mb-8">
      <CardContent className="p-6">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-3">Download YouTube Videos</h2>
          <p className="text-muted-foreground text-lg">Paste a YouTube URL below to get started</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="url" className="text-sm font-medium text-foreground">
              YouTube URL
            </Label>
            <div className="relative">
              <Input
                {...form.register("url")}
                id="url"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                className="url-input pl-4 pr-12"
                data-testid="input-youtube-url"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Link className="text-muted-foreground h-5 w-5" />
              </div>
            </div>
            {(form.formState.errors.url || urlError) && (
              <p className="text-sm text-destructive" data-testid="text-url-error">
                {form.formState.errors.url?.message || urlError}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quality" className="text-sm font-medium text-foreground">
                Quality
              </Label>
              <Select 
                value={form.watch("quality")} 
                onValueChange={(value) => form.setValue("quality", value as any)}
              >
                <SelectTrigger data-testid="select-quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                  <SelectItem value="720p">720p (HD)</SelectItem>
                  <SelectItem value="480p">480p (SD)</SelectItem>
                  <SelectItem value="360p">360p</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="format" className="text-sm font-medium text-foreground">
                Format
              </Label>
              <Select 
                value={form.watch("format")} 
                onValueChange={(value) => form.setValue("format", value as any)}
              >
                <SelectTrigger data-testid="select-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp4">MP4 (Video)</SelectItem>
                  <SelectItem value="webm">WebM (Video)</SelectItem>
                  <SelectItem value="mp3">MP3 (Audio Only)</SelectItem>
                  <SelectItem value="wav">WAV (Audio Only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            type="submit" 
            className="btn-primary w-full py-4 px-6 font-semibold"
            disabled={isLoading}
            data-testid="button-download"
          >
            <div className="flex items-center justify-center space-x-3">
              <Download className="h-5 w-5" />
              <span>{isLoading ? "Processing..." : "Download Video"}</span>
            </div>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
