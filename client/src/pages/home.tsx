import Header from "@/components/header";
import Footer from "@/components/footer";
import DownloadForm from "@/components/download-form";
import VideoPreview from "@/components/video-preview";
import DownloadProgress from "@/components/download-progress";
import DownloadedFiles from "@/components/downloaded-files";
import { useState } from "react";

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: string;
  channel: string;
  views: string;
}

export default function Home() {
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [currentDownloadId, setCurrentDownloadId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <DownloadForm 
          onVideoInfo={setVideoInfo} 
          onDownloadStart={setCurrentDownloadId}
        />
        
        {videoInfo && <VideoPreview videoInfo={videoInfo} />}
        
        {currentDownloadId && (
          <DownloadProgress 
            downloadId={currentDownloadId}
            onComplete={() => setCurrentDownloadId(null)}
          />
        )}
        
        <DownloadedFiles />
      </main>

      <Footer />
    </div>
  );
}
