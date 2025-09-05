import { Card, CardContent } from "@/components/ui/card";

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: string;
  channel: string;
  views: string;
}

interface VideoPreviewProps {
  videoInfo: VideoInfo;
}

export default function VideoPreview({ videoInfo }: VideoPreviewProps) {
  if (!videoInfo) return null;

  return (
    <Card className="shadow-lg border border-border mb-8" data-testid="card-video-preview">
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold text-foreground mb-4">Video Preview</h3>
        <div className="flex flex-col md:flex-row gap-4">
          <img 
            src={videoInfo.thumbnail || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=320&h=180"} 
            alt="Video thumbnail" 
            className="w-full md:w-80 h-45 object-cover rounded-md"
            data-testid="img-video-thumbnail"
          />
          <div className="flex-1">
            <h4 className="font-semibold text-foreground mb-2" data-testid="text-video-title">
              {videoInfo.title}
            </h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p data-testid="text-video-channel">{videoInfo.channel}</p>
              <p data-testid="text-video-duration">Duration: {videoInfo.duration}</p>
              <p data-testid="text-video-views">Views: {videoInfo.views}</p>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="quality-badge px-3 py-1 rounded-full text-xs font-medium">
                720p Available
              </span>
              <span className="quality-badge px-3 py-1 rounded-full text-xs font-medium">
                1080p Available
              </span>
              <span className="quality-badge px-3 py-1 rounded-full text-xs font-medium">
                Audio Only
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
