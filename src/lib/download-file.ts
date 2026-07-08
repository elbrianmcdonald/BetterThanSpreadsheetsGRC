/**
 * Client-side download helper for tRPC export payloads (Story 26.4).
 * Handles both utf8 (CSV) and base64 (XLSX) encodings.
 */
export interface DownloadableFile {
  filename: string;
  content: string;
  mimeType: string;
  encoding: "utf8" | "base64";
}

export function downloadExportFile(res: DownloadableFile): void {
  const blob =
    res.encoding === "base64"
      ? new Blob([Uint8Array.from(atob(res.content), (c) => c.charCodeAt(0))], {
          type: res.mimeType,
        })
      : new Blob([res.content], { type: res.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = res.filename;
  a.click();
  URL.revokeObjectURL(url);
}
