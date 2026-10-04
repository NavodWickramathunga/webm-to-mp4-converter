# WEBM → MP4 Converter

A small local web app that converts WebM videos to MP4 (H.264 video + AAC audio) using FFmpeg.
Files are processed on your own machine — nothing is uploaded to the internet.

## Requirements
- [Node.js](https://nodejs.org) 18+
- [FFmpeg](https://ffmpeg.org) (`ffmpeg` and `ffprobe` on your PATH)

## Run
Double-click `start.bat`, or:

```
node server.js
```

Then open http://localhost:5173, drop in one or more `.webm` files, and click **Download MP4** when each finishes.

## Options
| Option  | Effect |
|---------|--------|
| Quality | High (CRF 18), Balanced (CRF 23), Small file (CRF 28) |
| Speed   | x264 preset — faster = quicker conversion, slightly larger files |
| Audio   | Keep (AAC 192k) or remove |

Converted files are kept in your temp folder (`%TEMP%\webm-to-mp4`) and removed after an hour.
Set the `PORT` environment variable to use a different port.
