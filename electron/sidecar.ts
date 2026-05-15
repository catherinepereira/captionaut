import { ChildProcess, spawn } from "child_process";
import * as net from "net";
import * as path from "path";
import * as fs from "fs";
import { app } from "electron";

let sidecarProcess: ChildProcess | null = null;

async function findFreePort(start = 49152): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(start, "127.0.0.1", () => {
      const addr = server.address() as net.AddressInfo;
      server.close(() => resolve(addr.port));
    });
    server.on("error", () => findFreePort(start + 1).then(resolve, reject));
  });
}

function getSidecarPath(): string {
  const isWin = process.platform === "win32";
  const exeName = isWin ? "captionaut-backend.exe" : "captionaut-backend";
  const resourcesDir = process.resourcesPath ?? path.join(__dirname, "..", "..");

  const packed = path.join(resourcesDir, "sidecar", exeName);
  if (fs.existsSync(packed)) return packed;

  // Dev fallback: PyInstaller one-dir output
  const dev = path.join(__dirname, "..", "dist", "captionaut-backend", exeName);
  if (fs.existsSync(dev)) return dev;

  throw new Error(`Sidecar not found. Checked:\n  ${packed}\n  ${dev}`);
}

function getFFmpegPath(): string {
  const isWin = process.platform === "win32";
  const name = isWin ? "ffmpeg.exe" : "ffmpeg";
  const resourcesDir = process.resourcesPath ?? path.join(__dirname, "..", "..");

  const packed = path.join(resourcesDir, "ffmpeg", name);
  if (fs.existsSync(packed)) return packed;

  // Dev: fall back to system PATH
  return "ffmpeg";
}

function getDataDir(): string {
  const dir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// 120s default: the packaged PyInstaller bundle unpacks several GB to a
// temp dir on first launch, which can take a minute on slower disks.
async function waitForReady(port: number, maxMs = 120_000): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/status`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Backend never became ready on port ${port}`);
}

export async function startSidecar(): Promise<number> {
  const port = await findFreePort();

  const sidecarPath = getSidecarPath();
  const ffmpegPath = getFFmpegPath();
  const dataDir = getDataDir();

  sidecarProcess = spawn(
    sidecarPath,
    ["--port", String(port), "--data-dir", dataDir],
    {
      env: {
        ...process.env,
        FFMPEG_BIN: ffmpegPath,
        CAPTIONAUT_DATA_DIR: dataDir,
        // Prevent OpenMP duplicate lib crash on macOS
        KMP_DUPLICATE_LIB_OK: "TRUE",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }
  );

  sidecarProcess.stdout?.on("data", (d: Buffer) =>
    console.log("[backend]", d.toString().trim())
  );
  sidecarProcess.stderr?.on("data", (d: Buffer) =>
    console.error("[backend]", d.toString().trim())
  );
  sidecarProcess.on("exit", (code) => {
    console.log(`[backend] exited (code ${code})`);
    sidecarProcess = null;
  });

  await waitForReady(port);
  return port;
}

export function stopSidecar(): void {
  if (!sidecarProcess) return;
  if (process.platform === "win32") {
    // Kill entire process tree (PyInstaller spawns children)
    spawn("taskkill", ["/pid", String(sidecarProcess.pid!), "/f", "/t"], {
      windowsHide: true,
    });
  } else {
    sidecarProcess.kill("SIGTERM");
  }
  sidecarProcess = null;
}
