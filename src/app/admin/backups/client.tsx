"use client";

/**
 * Backups admin page — download a full backup (DB + uploads) or upload a
 * backup archive to restore over the running application. Restore is
 * destructive: it drops and recreates the `public` schema before applying
 * the dump, then replaces the uploads volume.
 */

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Download,
  Loader2,
  Upload,
  Database,
  RefreshCw,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function BackupsClient() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch("/api/admin/backup", { method: "GET" });
      if (!res.ok) {
        const text = await res.text();
        let message = `Backup failed (${res.status})`;
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          if (text) message = text;
        }
        throw new Error(message);
      }

      // Stream the response into a Blob so the browser can download it.
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(contentDisposition);
      const filename = match?.[1] ?? `btsgrc-backup-${Date.now()}.tar.gz`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
      toast.error(message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setIsRestoring(true);
    try {
      const formData = new FormData();
      formData.append("backup", restoreFile);
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        let message = `Restore failed (${res.status})`;
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          if (text) message = text;
        }
        throw new Error(message);
      }
      toast.success(
        "Restore complete. You'll be signed out so the backup's auth state takes effect."
      );
      // Bounce to login — the backup may have reset this user's auth state.
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Restore failed";
      toast.error(message);
    } finally {
      setIsRestoring(false);
      setConfirmOpen(false);
    }
  };

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Administration" },
        { label: "Backups" },
      ]}
    >
      <div className="container max-w-4xl mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6" />
            Backups
          </h1>
          <p className="text-muted-foreground mt-1">
            Download a complete copy of your organization's data and uploaded evidence,
            or restore from a previous backup archive.
          </p>
        </div>

        {/* Download */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download backup
            </CardTitle>
            <CardDescription>
              Produces a <code className="text-xs">.tar.gz</code> archive containing a
              full Postgres dump plus all uploaded evidence files. The download is
              generated on demand — no backup files are stored on the server.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={handleDownload} disabled={isDownloading}>
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Preparing archive...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download backup
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Restore */}
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Restore from backup
            </CardTitle>
            <CardDescription>
              Upload a backup archive produced by this app. The restore will
              <strong> wipe the current database</strong>, apply the dump, and replace
              the uploads volume with the archive's contents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium">
                  This is destructive and irreversible.
                </p>
                <ul className="list-disc pl-5">
                  <li>All current data will be replaced with the backup's contents.</li>
                  <li>Active user sessions will be invalidated after the restore.</li>
                  <li>You'll be bounced to /login and may need different credentials.</li>
                  <li>Download a fresh backup first if you want an escape hatch.</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".tar.gz,.tgz,application/gzip,application/x-gzip,application/x-compressed-tar"
                onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-input file:bg-background file:text-sm hover:file:bg-muted cursor-pointer"
              />
              {restoreFile && (
                <p className="text-xs text-muted-foreground">
                  Selected: <span className="font-mono">{restoreFile.name}</span> (
                  {Math.round((restoreFile.size / 1024 / 1024) * 10) / 10} MB)
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={!restoreFile || isRestoring}
            >
              {isRestoring ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Restore from this file
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Replace all data with this backup?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Every record in the application will be replaced with the contents
                    of <span className="font-mono">{restoreFile?.name ?? ""}</span>.
                    This cannot be undone from the UI.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    On completion you'll be signed out. Sign in again with the
                    credentials that exist in the backup.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleRestore();
                }}
                disabled={isRestoring}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isRestoring ? "Restoring..." : "Replace data now"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
