import Docker from "dockerode";
import tar from "tar-stream";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { Writable } from "node:stream";
import { finished } from "node:stream/promises";
import { sandboxConfig as limits } from "../config/sandbox.js";
import { languages } from "../config/languages.js";
import { AppError } from "../utils/AppError.js";

const docker = new Docker({
  socketPath: limits.socketPath,
  timeout: limits.requestTimeoutMs,
});

async function sourceArchive(language, code, stdin) {
  const archive = tar.pack();
  for (const [name, text] of [
    [language.sourceFile, code],
    [limits.stdinFile, stdin],
  ]) {
    // Names come only from trusted config, never from the request.
    archive.entry({ name, mode: 0o444 }, text);
  }
  archive.finalize();
  const chunks = [];
  for await (const chunk of archive) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function outputText(chunks, maxBytes) {
  const text = Buffer.concat(chunks).toString('utf8');
  const bytes = Buffer.from(text).subarray(0, maxBytes);
  // Drop an incomplete final character so UTF-8 decoding cannot exceed the byte cap.
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes, { stream: true });
}

export async function runCode(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AppError("Expected language, code, and optional stdin", 400);
  }
  const { language: id, code, stdin = "" } = input;
  const language =
    typeof id === "string" && Object.hasOwn(languages, id)
      ? languages[id]
      : null;
  if (!language) throw new AppError("Unsupported language", 400);
  if (typeof code !== "string" || !code.trim())
    throw new AppError("Code is required", 400);
  if (typeof stdin !== "string")
    throw new AppError("stdin must be a string", 400);
  if (
    Buffer.byteLength(code) > limits.maxCodeBytes ||
    Buffer.byteLength(stdin) > limits.maxStdinBytes
  ) {
    throw new AppError("Code or stdin exceeds the configured size limit", 413);
  }

  const startedAt = performance.now();
  const name = `compilex-run-${randomUUID()}`;
  // Keep a handle by name even if a create request fails after Docker created it.
  const container = docker.getContainer(name);
  const output = { stdout: [], stderr: [] };
  let outputBytes = 0;
  let timedOut = false;
  let outputExceeded = false;
  let memoryLimited = false;
  let phase = language.compileCommand ? "compile" : "run";
  let exitCode = null;
  let timer;
  let events;
  let activeStream;
  let killPromise;
  let controlError;

  function killContainer() {
    killPromise ??= container.kill({ signal: "SIGKILL" }).catch((error) => {
      if (![404, 409].includes(error.statusCode)) {
        controlError = error;
        activeStream?.destroy(error);
      }
    });
    return killPromise;
  }

  function capture(channel) {
    return new Writable({
      write(chunk, encoding, callback) {
        const remaining = limits.maxOutputBytes - outputBytes;
        const kept = chunk.subarray(0, remaining);
        if (kept.length) output[channel].push(kept);
        outputBytes += kept.length;
        if (chunk.length > remaining && !outputExceeded) {
          outputExceeded = true;
          void killContainer();
        }
        callback();
      },
    });
  }

  async function execute(command) {
    if (timedOut || outputExceeded || controlError) return null;
    const execution = await container.exec({
      Cmd: command,
      User: limits.user,
      WorkingDir: limits.workDir,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });
    if (timedOut || outputExceeded || controlError) return null;
    activeStream = await execution.start({
      hijack: true,
      stdin: false,
    });
    const complete = finished(activeStream, {
      readable: true,
      writable: false,
      cleanup: true,
    });
    docker.modem.demuxStream(
      activeStream,
      capture("stdout"),
      capture("stderr"),
    );
    await complete;
    const state = await execution.inspect();
    return state.ExitCode;
  }

  try {
    const created = await docker.createContainer({
      name,
      Image: language.image,
      Cmd: limits.idleCommand,
      Entrypoint: [],
      User: limits.user,
      WorkingDir: limits.workDir,
      Tty: false,
      Labels: { [limits.label]: "true" },
      Env: [
        `HOME=${limits.workDir}`,
        `SANDBOX_STDIN_FILE=${limits.workDir}/${limits.stdinFile}`,
      ],
      HostConfig: {
        NetworkMode: "none",
        Memory: limits.memoryBytes,
        MemorySwap: limits.memorySwapBytes,
        NanoCpus: limits.nanoCpus,
        PidsLimit: limits.pidsLimit,
        ReadonlyRootfs: true,
        Tmpfs: {
          [limits.workDir]: `rw,exec,nosuid,nodev,size=${limits.tmpfsMb}m,mode=1777`,
        },
        CapDrop: ["ALL"],
        SecurityOpt: ["no-new-privileges"],
        Init: true,
        LogConfig: { Type: "none" },
        RestartPolicy: { Name: "no" },
      },
    });
    timer = setTimeout(() => {
      timedOut = true;
      void killContainer();
    }, limits.timeoutMs);
    // A filtered event means a real cgroup OOM, even if only an exec child was killed.
    events = await docker.getEvents({
      filters: JSON.stringify({ container: [created.id], event: ["oom"] }),
    });
    events.on("data", () => {
      memoryLimited = true;
    });
    events.on("error", (error) => {
      controlError = error;
      void killContainer();
    });
    await container.start();
    const archive = (await sourceArchive(language, code, stdin)).toString('base64');
    const parts = [];
    for (let offset = 0; offset < archive.length; offset += limits.archiveChunkChars) {
      parts.push(archive.slice(offset, offset + limits.archiveChunkChars));
    }
    // Only data arguments contain the archive; this shell pipeline is fixed and trusted.
    const uploaded = await execute(
      ['sh', '-c', 'printf "%s" "$@" | base64 -d | tar -xf - -C "$HOME"', 'sandbox-upload', ...parts],
    );
    if (uploaded !== 0 && !timedOut && !outputExceeded)
      throw new Error("Sandbox source delivery failed");

    if (language.compileCommand)
      exitCode = await execute(language.compileCommand);
    if (!language.compileCommand || exitCode === 0) {
      phase = "run";
      // Only this fixed wrapper is a shell command; source and input are never interpolated.
      exitCode = await execute([
        "sh",
        "-c",
        'exec "$@" < "$SANDBOX_STDIN_FILE"',
        "sandbox",
        ...language.runCommand,
      ]);
    }
    const state = await container.inspect();
    memoryLimited ||= state.State.OOMKilled;
  } catch (error) {
    if (!timedOut && !outputExceeded && !memoryLimited) throw error;
  } finally {
    clearTimeout(timer);
    events?.destroy();
    activeStream?.destroy();
    if (killPromise) await killPromise;
    try {
      await container.remove({ force: true, v: true });
    } catch (error) {
      if (error.statusCode !== 404) throw error;
    }
  }
  if (controlError) throw controlError;

  let status = "success";
  if (memoryLimited) status = "memory_limit";
  else if (timedOut) status = "timeout";
  else if (outputExceeded || exitCode !== 0)
    status = phase === "compile" ? "compile_error" : "runtime_error";

  const stdout = outputText(output.stdout, limits.maxOutputBytes);
  const stderr = outputText(output.stderr, limits.maxOutputBytes - Buffer.byteLength(stdout));
  return {
    status,
    stdout,
    stderr,
    exitCode,
    durationMs: Math.round(performance.now() - startedAt),
  };
}
