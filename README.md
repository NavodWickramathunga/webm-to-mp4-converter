# WEBM → MP4 Converter

Convert WebM videos to MP4 (H.264 video + AAC audio). Files are processed on your own device — nothing is uploaded anywhere.

## Use it online
**https://navodwickramathunga.github.io/webm-to-mp4-converter/**

Runs entirely in your browser, with two modes:
- **Convert to H.264** (default) — re-encodes to H.264 + AAC so the MP4 plays everywhere. Uses the browser's
  built-in video encoder via WebCodecs ([Mediabunny](https://mediabunny.dev)), which can use your graphics hardware.
- **Quick** — copies the original video/audio into an MP4 without re-encoding. Takes seconds, but VP9-in-MP4
  doesn't play in some older players or older iPhones.

Browsers without WebCodecs support fall back to [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)
(slower, downloads a ~30 MB engine the first time). Works best for files under ~1 GB.
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

Converted files are not kept: each MP4 is deleted from the temp folder (`%TEMP%\webm-to-mp4`) as soon as you download it, and anything not downloaded is removed after an hour.
Set the `PORT` environment variable to use a different port.

## Options
| Option  | Effect |
|---------|--------|
| Quality | High (CRF 18), Balanced (CRF 23), Small file (CRF 28) |
| Speed   | x264 preset — faster = quicker conversion, slightly larger files |
| Audio   | Keep (AAC 192k) or remove |
