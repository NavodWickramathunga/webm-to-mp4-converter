// WEBM → MP4 Converter — local web app powered by FFmpeg.
// Zero npm dependencies. Run: node server.js  then open http://localhost:5173

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT) || 5173;
const WORK_DIR = path.join(os.tmpdir(), 'webm-to-mp4');
const JOB_TTL_MS = 60 * 60 * 1000; // clean up finished jobs after 1 hour
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB

const QUALITY = { high: 18, balanced: 23, small: 28 };
const SPEED = new Set(['ultrafast', 'veryfast', 'fast', 'medium', 'slow']);

fs.mkdirSync(WORK_DIR, { recursive: true });

/** @type {Map<string, {status:string, progress:number|null, duration:number|null, input:string, output:string, name:string, error?:string, size?:number, finishedAt?:number}>} */
const jobs = new Map();

function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, { 'Content-Type': isObj ? 'application/json' : 'text/plain; charset=utf-8', ...headers });
  res.end(isObj ? JSON.stringify(body) : body);
}

function probeDuration(file) {
  return new Promise((resolve) => {
    const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('error', () => resolve(null));
    p.on('close', () => {
      const n = parseFloat(out);
      resolve(Number.isFinite(n) && n > 0 ? n : null);
    });
  });
}

async function runJob(id, opts) {
  const job = jobs.get(id);
  job.status = 'converting';
  job.duration = await probeDuration(job.input);

  const args = [
    '-hide_banner', '-y', '-i', job.input,
    // H.264 needs even dimensions; yuv420p for maximum player compatibility.
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264', '-preset', opts.speed, '-crf', String(opts.crf), '-pix_fmt', 'yuv420p',
    ...(opts.audio ? ['-c:a', 'aac', '-b:a', '192k'] : ['-an']),
    '-movflags', '+faststart',
    '-progress', 'pipe:1', '-nostats',
    job.output,
  ];

  const ff = spawn('ffmpeg', args);
  let stderr = '';
  ff.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000); });
  ff.stdout.on('data', (d) => {
    const times = [...String(d).matchAll(/out_time_us=(\d+)/g)];
    if (times.length && job.duration) {
      const seconds = Number(times[times.length - 1][1]) / 1e6;
      job.progress = Math.min(99, (seconds / job.duration) * 100);
    }
  });
  ff.on('error', (err) => {
    job.status = 'error';
    job.error = `Could not start ffmpeg: ${err.message}`;
  });
  ff.on('close', (code) => {
    fs.rm(job.input, { force: true }, () => {});
    job.finishedAt = Date.now();
    if (code === 0) {
      job.status = 'done';
      job.progress = 100;
      job.size = fs.statSync(job.output).size;
      // Remember the original name on disk so downloads still work after a server restart.
      fs.writeFile(job.output.replace(/\.mp4$/, '.json'), JSON.stringify({ name: job.name }), () => {});
    } else if (job.status !== 'error') {
      job.status = 'error';
      job.error = stderr.trim().split('\n').slice(-3).join('\n') || `ffmpeg exited with code ${code}`;
    }
  });
}

function handleUpload(req, res, url) {
  const name = (url.searchParams.get('name') || 'video.webm').replace(/[\\/:*?"<>|]/g, '_');
  const crf = QUALITY[url.searchParams.get('quality')] ?? QUALITY.balanced;
  const speed = SPEED.has(url.searchParams.get('speed')) ? url.searchParams.get('speed') : 'veryfast';
  const audio = url.searchParams.get('audio') !== '0';

  const id = crypto.randomUUID();
  const input = path.join(WORK_DIR, `${id}.in`);
  const output = path.join(WORK_DIR, `${id}.mp4`);
  const out = fs.createWriteStream(input);
  let bytes = 0;

  req.on('data', (chunk) => {
    bytes += chunk.length;
    if (bytes > MAX_UPLOAD_BYTES) {
      req.destroy();
      out.destroy();
      fs.rm(input, { force: true }, () => {});
    }
  });
  req.pipe(out);
  out.on('finish', () => {
    jobs.set(id, { status: 'queued', progress: null, duration: null, input, output, name });
    runJob(id, { crf, speed, audio });
    send(res, 200, { id });
  });
  out.on('error', (err) => send(res, 500, { error: err.message }));
}

// Rebuild a finished job from disk (e.g. after the server was restarted).
function loadFinishedJob(id) {
  const output = path.join(WORK_DIR, `${id}.mp4`);
  try {
    const size = fs.statSync(output).size;
    let name = 'video.webm';
    try { name = JSON.parse(fs.readFileSync(output.replace(/\.mp4$/, '.json'), 'utf8')).name || name; } catch {}
    return { status: 'done', progress: 100, output, name, size };
  } catch {
    return null;
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, html) => {
      if (err) return send(res, 404, 'index.html not found');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/convert') return handleUpload(req, res, url);

  const m = /^\/api\/(status|download)\/([\w-]+)$/.exec(url.pathname);
  if (req.method === 'GET' && m) {
    const job = jobs.get(m[2]) || loadFinishedJob(m[2]);
    if (!job) return send(res, 404, { error: 'File not found — it may have expired. Please convert it again.' });

    if (m[1] === 'status') {
      return send(res, 200, { status: job.status, progress: job.progress, error: job.error, size: job.size });
    }
    if (job.status !== 'done') return send(res, 409, { error: 'Not ready' });
    const outName = job.name.replace(/\.[^.]+$/, '') + '.mp4';
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': job.size,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(outName)}`,
    });
    return fs.createReadStream(job.output).pipe(res);
  }

  send(res, 404, 'Not found');
});

// Periodically delete old job files (including ones left over from previous runs).
function cleanup() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.finishedAt && now - job.finishedAt > JOB_TTL_MS) jobs.delete(id);
  }
  for (const file of fs.readdirSync(WORK_DIR)) {
    const id = file.replace(/\.[^.]+$/, '');
    if (jobs.has(id)) continue;
    const full = path.join(WORK_DIR, file);
    try {
      if (now - fs.statSync(full).mtimeMs > JOB_TTL_MS) fs.rmSync(full, { force: true });
    } catch {}
  }
}
cleanup();
setInterval(cleanup, 5 * 60 * 1000).unref();

server.listen(PORT, '127.0.0.1', () => {
  console.log(`WEBM → MP4 Converter running at http://localhost:${PORT}`);
});
