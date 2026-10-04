# WEBM → MP4 Converter

Convert WebM videos to MP4 (H.264 video + AAC audio). Files are processed on your own device — nothing is uploaded anywhere.

## Use it online
**https://navodwickramathunga.github.io/webm-to-mp4-converter/**

Runs entirely in your browser using [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm).
The converter engine (~30 MB) downloads the first time you convert a file. Works best for files under ~1 GB.
The site lives in the [`docs/`](docs) folder and is served by GitHub Pages.

## Run it locally (faster, for large files)
The local version uses your installed FFmpeg, which is much faster than the browser version.

Requirements:
- [Node.js](https://nodejs.org) 18+
- [FFmpeg](https://ffmpeg.org) (`ffmpeg` and `ffprobe` on your PATH)

Double-click `start.bat`, or:

```
node server.js
```

Then open http://localhost:5173, drop in one or more `.webm` files, and click **Download MP4** when each finishes.

Converted files are kept in your temp folder (`%TEMP%\webm-to-mp4`) and removed after an hour.
Set the `PORT` environment variable to use a different port.

## Options
| Option  | Effect |
|---------|--------|
| Quality | High (CRF 18), Balanced (CRF 23), Small file (CRF 28) |
| Speed   | x264 preset — faster = quicker conversion, slightly larger files |
| Audio   | Keep (AAC 192k) or remove |
