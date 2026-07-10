/**
 * POST /api/admin/restore
 *
 * Multipart upload of a backup archive produced by /api/admin/backup. The
 * archive is expected to contain `db.sql` + `uploads/...`. Executes:
 *   1. Drop and recreate the public schema on the target database.
 *   2. psql -f db.sql to rehydrate data.
 *   3. rm -rf /app/uploads/* and replace from the archive.
 *
 * Gated to ORG_ADMIN. Inherently destructive — caller must be signed in as
 * admin at the time of the request. After a successful restore the caller's
 * session may be invalidated if the backup's User/Session rows differ, in
 * which case they'll be bounced to /login on the next navigation.
 */

import { NextResponse, type NextRequest } from "next/server";
import { spawn } from "child_process";
import { mkdtemp, rm, writeFile, readFile, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { auth } from "@/server/auth";

// Lines that pg_dump 17 emits which older Postgres servers (e.g. 15) reject.
// Harmless to strip — these are session-tuning SETs, not schema/data.
const INCOMPATIBLE_SET_LINES = [
  /^SET\s+transaction_timeout\b/i,
  /^\\restrict\b/i,
  /^\\unrestrict\b/i,
];

function sanitizeDumpLines(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !INCOMPATIBLE_SET_LINES.some((r) => r.test(line)))
    .join("\n");
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Restore archives can be large; bump the default body-size cap.
export const maxDuration = 300;

function execCapture(
  command: string,
  args: string[],
  opts: { env?: NodeJS.ProcessEnv; cwd?: string; input?: string | Buffer } = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...(opts.env ?? {}) },
      cwd: opts.cwd,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => (stdout += c.toString()));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }));
    if (opts.input) {
      if (typeof opts.input === "string") child.stdin.end(opts.input);
      else child.stdin.end(opts.input);
    }
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.user.role !== "ADMINISTRATOR") {
    return NextResponse.json(
      { error: "Only organization admins can restore backups" },
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

  const form = await req.formData().catch(() => null);
  const file = form?.get("backup");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "No backup file uploaded (expected field 'backup')" },
      { status: 400 }
    );
  }

  const stageDir = await mkdtemp(join(tmpdir(), "btsgrc-restore-"));
  try {
    // Write the upload to disk before touching it with tar / psql.
    const archivePath = join(stageDir, "upload.tar.gz");
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(archivePath, bytes);

    // Extract into stageDir so we can verify shape before applying.
    const extract = await execCapture("tar", ["-xzf", archivePath, "-C", stageDir]);
    if (extract.code !== 0) {
      throw new Error(`tar extraction failed: ${extract.stderr || "unknown"}`);
    }

    const sqlPath = join(stageDir, "db.sql");
    const extractedUploadsPath = join(stageDir, "uploads");
    const sqlStat = await stat(sqlPath).catch(() => null);
    if (!sqlStat || !sqlStat.isFile()) {
      throw new Error("Archive does not contain db.sql — not a valid backup");
    }

    // Pre-sanitize to strip SETs / psql meta-commands that target newer
    // Postgres versions than the live server. Rewrites the staged file in
    // place so the original archive is untouched.
    const rawSql = await readFile(sqlPath, "utf8");
    await writeFile(sqlPath, sanitizeDumpLines(rawSql));

    // DROP + recreate the public schema so restore starts from a clean slate.
    // Use psql here too so we stay within a single transport.
    const drop = await execCapture(
      "psql",
      [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"]
    );
    if (drop.code !== 0) {
      throw new Error(`Schema reset failed: ${drop.stderr || "unknown"}`);
    }

    // Apply the dump. `ON_ERROR_STOP` so we bail on first error rather than
    // applying a partial restore.
    const apply = await execCapture("psql", [
      databaseUrl,
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      sqlPath,
    ]);
    if (apply.code !== 0) {
      throw new Error(`SQL restore failed: ${apply.stderr || "unknown"}`);
    }

    // Replace the uploads directory. If the backup omitted uploads (older
    // archives), leave the existing volume untouched.
    const uploadsStat = await stat(extractedUploadsPath).catch(() => null);
    if (uploadsStat?.isDirectory()) {
      // Wipe the live uploads. rm with -rf tolerates missing entries.
      await rm("/app/uploads", { recursive: true, force: true }).catch(() => {
        // If deletion fails (e.g. permissions), surface via the copy step.
      });
      const copy = await execCapture("cp", [
        "-r",
        extractedUploadsPath,
        "/app/uploads",
      ]);
      if (copy.code !== 0) {
        throw new Error(`Uploads copy failed: ${copy.stderr || "unknown"}`);
      }
    }

    return NextResponse.json({ success: true, message: "Restore complete" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "restore failed";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await rm(stageDir, { recursive: true, force: true }).catch(() => {
      // best-effort cleanup
    });
  }
}
