import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const nextCli = path.join(repositoryRoot, "node_modules", "next", "dist", "bin", "next");
const playwrightCli = path.join(
  repositoryRoot,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);
const port = Number(process.env.SOLMIND_BROWSER_TEST_PORT ?? "4173");
const host = "127.0.0.1";
const baseURL = `http://${host}:${port}`;

if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("SOLMIND_BROWSER_TEST_PORT must be an integer from 1024 through 65535.");
}

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const isPortListening = () =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (listening) => {
      socket.destroy();
      resolve(listening);
    };
    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });

const runNode = (arguments_) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, arguments_, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Command stopped by ${signal}: ${arguments_.join(" ")}`));
        return;
      }
      resolve(code ?? 1);
    });
  });

const waitForReady = async (server) => {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next.js exited before becoming ready (code ${server.exitCode}).`);
    }
    try {
      const response = await fetch(baseURL, {
        redirect: "manual",
        signal: AbortSignal.timeout(1_000),
      });
      if (response.status > 0) {
        return;
      }
    } catch {
      // The bounded readiness loop retries until the deadline or process exit.
    }
    await delay(250);
  }
  throw new Error(`Next.js did not become ready at ${baseURL} within 120 seconds.`);
};

const stopOwnedServer = async (server) => {
  if (server.exitCode === null && server.pid) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill("SIGTERM");
    await Promise.race([exited, delay(5_000)]);
    if (server.exitCode === null) {
      server.kill("SIGKILL");
    }
  }

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (!(await isPortListening())) {
      return;
    }
    await delay(200);
  }
  throw new Error(`Owned Next.js process stopped, but port ${port} is still listening.`);
};

if (await isPortListening()) {
  throw new Error(`Port ${port} is already listening; the harness will not reuse it.`);
}

const buildCode = await runNode([nextCli, "build"]);
if (buildCode !== 0) {
  process.exitCode = buildCode;
} else {
  const server = spawn(
    process.execPath,
    [nextCli, "start", "--hostname", host, "--port", String(port)],
    {
      cwd: repositoryRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    },
  );

  let browserTestCode = 1;
  try {
    await waitForReady(server);
    browserTestCode = await runNode([playwrightCli, "test"]);
  } finally {
    await stopOwnedServer(server);
  }
  if (browserTestCode === 0) {
    await rm(path.join(repositoryRoot, "test-results", "browser"), {
      recursive: true,
      force: true,
    });
  }
  process.exitCode = browserTestCode;
}
