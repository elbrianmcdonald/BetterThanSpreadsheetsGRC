/**
 * GET /api/admin/backup
 *
 * Streams a full-application backup to the caller as a gzip tar archive:
 *   - db.sql        — `pg_dump` of the entire Postgres database (plain-text)
 *   - uploads/...   — contents of the evidence-upload volume
 *
 * Gated to ORG_ADMIN. Credentials for the database are pulled from the
 * DATABASE_URL env var (set by docker-compose). `pg_dump` and `tar` are
 * installed in the runner stage of the Dockerfile.
 */

import { NextResponse, type NextRequest } from "next/server";
import { spawn } from "child_process";
import { mkdtemp, rm, writeFile, readFile, symlink, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { auth } from "@/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function execCapture(
  command: string,
  args: string[],
  opts: { env?: NodeJS.ProcessEnv; input?: string } = {}
): Promise<{ stdout: Buffer; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...(opts.env ?? {}) },
    });
    const stdoutChunks: Buffer[] = [];
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => stdoutChunks.push(c));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString()));
    child.on("error", reject);
    child.on("close", (code) =>
      resolve({ stdout: Buffer.concat(stdoutChunks), stderr, code: code ?? 0 })
    );
    if (opts.input) {
      child.stdin.end(opts.input);
    }
  });
}

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.user.role !== "ADMINISTRATOR") {
    return NextResponse.json(
      { error: "Only organization admins can download backups" },
      { status: 403 }
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured" },
      { status: 500 }
    );
  }

  // Stage the archive in a temp directory, then stream it back. Staging to
  // disk avoids holding the entire dump in memory for large organizations.
  const stageDir = await mkdtemp(join(tmpdir(), "btsgrc-backup-"));
  let archivePath: string | null = null;
  try {
    // 1. pg_dump plain-text SQL (portable, human-inspectable on restore).
    const dump = await execCapture("pg_dump", ["--no-owner", "--no-privileges", databaseUrl]);
    if (dump.code !== 0) {
      throw new Error(`pg_dump failed: ${dump.stderr || "unknown error"}`);
    }
    await writeFile(join(stageDir, "db.sql"), dump.stdout);

    // 2. Stage the uploads directory alongside db.sql as a symlink, then
    //    archive the whole staging tree in one go. BusyBox's tar (Alpine)
    //    doesn't support multiple -C flags, so we assemble the layout first
    //    and use -h to dereference the symlink into the archive.
    const uploadsStat = await stat("/app/uploads").catch(() => null);
    if (uploadsStat?.isDirectory()) {
      await symlink("/app/uploads", join(stageDir, "uploads"));
    }
    archivePath = join(tmpdir(), `btsgrc-backup-archive-${Date.now()}.tar.gz`);
    const tarResult = await execCapture(
      "tar",
      ["-czhf", archivePath, "-C", stageDir, "."]
    );
    if (tarResult.code !== 0) {
      throw new Error(`tar failed: ${tarResult.stderr || "unknown error"}`);
    }

    const bytes = await readFile(archivePath);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `btsgrc-backup-${stamp}.tar.gz`;

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(bytes.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "backup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await rm(stageDir, { recursive: true, force: true }).catch(() => {
      // best-effort cleanup
    });
    if (archivePath) {
      await rm(archivePath, { force: true }).catch(() => {
        // best-effort cleanup
      });
    }
  }
}
