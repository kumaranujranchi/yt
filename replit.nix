{ pkgs }:
{
  deps = [
    pkgs.nodejs_20
    pkgs.yt-dlp
    pkgs.ffmpeg
    pkgs.curl
    pkgs.bash
    pkgs.coreutils
  ];
}