import { Youtube } from "lucide-react";

export default function Header() {
  return (
    <header className="bg-card shadow-sm border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Youtube className="text-primary-foreground text-xl" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">YouTube Downloader</h1>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">Fast • Secure • Free</span>
          </div>
        </div>
      </div>
    </header>
  );
}
