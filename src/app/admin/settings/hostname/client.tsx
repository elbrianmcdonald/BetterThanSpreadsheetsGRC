"use client";

/**
 * Hostname + TLS configuration.
 *
 * Two modes:
 *   - AUTO: Let's Encrypt via Caddy ACME (requires public DNS + ports 80/443).
 *   - BYOC: bring your own certificate — upload cert.pem + key.pem + optional
 *           chain.pem. Server-side validation parses the PEM, verifies the
 *           key/cert pair matches, checks SAN/CN against the hostname, and
 *           rejects near-expiry certs.
 *
 * Submitting writes to the DB + shared volume + hot-reloads Caddy via its
 * admin API. If Caddy is unreachable (e.g., running without the production
 * profile), the save still succeeds and re-applies on next boot.
 */

import { useState, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Upload,
  X,
  FileLock2,
} from "lucide-react";
import { HostnameMode } from "@prisma/client";
import { api } from "@/trpc/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PemFileState {
  name: string;
  content: string;
}

async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsText(file);
  });
}

function FileField(props: {
  label: string;
  accept?: string;
  value: PemFileState | null;
  onChange: (value: PemFileState | null) => void;
  required?: boolean;
  description?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <Label>
        {props.label}
        {props.required && <span className="text-destructive"> *</span>}
      </Label>
      <div className="flex items-center gap-2 mt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          {props.value ? "Replace" : "Choose file"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={props.accept ?? ".pem,.crt,.cer,.key,text/plain"}
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const content = await readTextFile(file);
              props.onChange({ name: file.name, content });
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Could not read file"
              );
            }
          }}
        />
        {props.value && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileLock2 className="h-4 w-4" />
            <span className="truncate max-w-xs">{props.value.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                props.onChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      {props.description && (
        <p className="text-xs text-muted-foreground mt-1">
          {props.description}
        </p>
      )}
    </div>
  );
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

export function HostnameSettingsClient() {
  const utils = api.useUtils();
  const { data: current, isLoading } =
    api.systemSettings.getHostnameConfig.useQuery();

  const [hostname, setHostname] = useState("");
  const [mode, setMode] = useState<HostnameMode>(HostnameMode.AUTO);
  const [acmeEmail, setAcmeEmail] = useState("");
  const [cert, setCert] = useState<PemFileState | null>(null);
  const [key, setKey] = useState<PemFileState | null>(null);
  const [chain, setChain] = useState<PemFileState | null>(null);

  // Hydrate form from current config the first time it loads
  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && current) {
    setHostname(current.hostname);
    setMode(current.mode);
    setAcmeEmail(current.acmeEmail ?? "");
    setHydrated(true);
  }

  const save = api.systemSettings.updateHostname.useMutation({
    onSuccess: (result) => {
      if (!result.caddyReachable) {
        toast.warning(
          "Config saved — Caddy is not running (add --profile production). It will apply on next start."
        );
      } else if (!result.applied) {
        toast.error(
          `Config saved but Caddy rejected it: ${result.error ?? "unknown error"}`
        );
      } else {
        toast.success("Hostname config applied");
      }
      void utils.systemSettings.getHostnameConfig.invalidate();
      // Clear cert inputs — never keep PEMs in form state after save
      setCert(null);
      setKey(null);
      setChain(null);
    },
    onError: (err) => toast.error(err.message || "Save failed"),
  });

  const handleSubmit = () => {
    if (!hostname.trim()) {
      toast.error("Hostname is required");
      return;
    }
    if (mode === HostnameMode.BYOC && (!cert || !key)) {
      toast.error(
        "Certificate and private key are required for bring-your-own-cert mode"
      );
      return;
    }

    save.mutate({
      hostname: hostname.trim(),
      mode,
      acmeEmail:
        mode === HostnameMode.AUTO ? acmeEmail.trim() || undefined : undefined,
      certPem: mode === HostnameMode.BYOC ? cert?.content : undefined,
      keyPem: mode === HostnameMode.BYOC ? key?.content : undefined,
      chainPem:
        mode === HostnameMode.BYOC && chain?.content
          ? chain.content
          : undefined,
    });
  };

  const expiryBadge = () => {
    if (!current?.certNotAfter) return null;
    const expiryMs = new Date(current.certNotAfter).getTime();
    const daysLeft = Math.floor((expiryMs - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (daysLeft < 14) {
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-200">
          Expires in {daysLeft}d
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        Expires in {daysLeft}d
      </Badge>
    );
  };

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Administration" },
        { label: "Settings", href: "/admin/settings" },
        { label: "Hostname & HTTPS" },
      ]}
    >
      <div className="container max-w-4xl mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Globe className="h-6 w-6" />
              Hostname & HTTPS
            </h1>
            <p className="text-muted-foreground mt-1">
              Public DNS name and TLS cert for this deployment's reverse proxy.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/admin/settings">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>

        {/* Current status */}
        <Card>
          <CardHeader>
            <CardTitle>Current status</CardTitle>
            <CardDescription>
              Last-saved configuration and apply result.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </div>
            ) : !current ? (
              <p className="text-sm text-muted-foreground">
                No configuration saved yet. The app is reachable over plain HTTP
                on port 80; configure a hostname + TLS below to enable HTTPS.
              </p>
            ) : (
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-8 text-sm">
                <div>
                  <dt className="text-muted-foreground">Hostname</dt>
                  <dd className="font-mono">{current.hostname}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Mode</dt>
                  <dd>
                    {current.mode === HostnameMode.AUTO
                      ? "Auto-HTTPS (Let's Encrypt)"
                      : "Bring your own cert"}
                  </dd>
                </div>
                {current.mode === HostnameMode.AUTO && current.acmeEmail && (
                  <div>
                    <dt className="text-muted-foreground">ACME email</dt>
                    <dd>{current.acmeEmail}</dd>
                  </div>
                )}
                {current.mode === HostnameMode.BYOC && (
                  <>
                    <div>
                      <dt className="text-muted-foreground">Cert expiry</dt>
                      <dd className="flex items-center gap-2">
                        {formatDate(current.certNotAfter)}
                        {expiryBadge()}
                      </dd>
                    </div>
                    <div className="md:col-span-2">
                      <dt className="text-muted-foreground">Cert SANs</dt>
                      <dd className="font-mono text-xs break-all">
                        {current.certSANs.length
                          ? current.certSANs.join(", ")
                          : "—"}
                      </dd>
                    </div>
                  </>
                )}
                <div>
                  <dt className="text-muted-foreground">Last applied</dt>
                  <dd className="flex items-center gap-2">
                    {formatDate(current.lastAppliedAt)}
                    {current.lastAppliedOk ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : current.lastAppliedAt ? (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    ) : null}
                  </dd>
                </div>
                {current.lastApplyError && (
                  <div className="md:col-span-2">
                    <dt className="text-muted-foreground">Last apply error</dt>
                    <dd className="text-xs text-destructive font-mono break-all">
                      {current.lastApplyError}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </CardContent>
        </Card>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Configure</CardTitle>
            <CardDescription>
              Saving replaces the running Caddy config on the grc_network.
              Cert files are stored with 0600 perms on a volume shared with
              Caddy only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="hostname">
                DNS name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="hostname"
                placeholder="grc.example.com"
                value={hostname}
                onChange={(e) => setHostname(e.target.value.trim())}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Bare DNS name only, no scheme or path. Must resolve to this
                host for HTTPS to work.
              </p>
            </div>

            <div>
              <Label>TLS mode</Label>
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as HostnameMode)}
                className="mt-2 space-y-2"
              >
                <div className="flex items-start gap-3 p-3 rounded-md border">
                  <RadioGroupItem
                    value={HostnameMode.AUTO}
                    id="mode-auto"
                    className="mt-1"
                  />
                  <Label htmlFor="mode-auto" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span className="font-medium">
                        Auto-HTTPS (Let's Encrypt)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-normal">
                      Caddy issues and renews a free cert via ACME HTTP-01
                      challenge. Requires public DNS pointing here and TCP
                      ports 80+443 reachable from the internet.
                    </p>
                  </Label>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-md border">
                  <RadioGroupItem
                    value={HostnameMode.BYOC}
                    id="mode-byoc"
                    className="mt-1"
                  />
                  <Label htmlFor="mode-byoc" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <FileLock2 className="h-4 w-4" />
                      <span className="font-medium">
                        Bring your own certificate
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-normal">
                      Upload a cert + private key (PEM). Use this for internal
                      hostnames, enterprise PKI, or pre-issued certs.
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {mode === HostnameMode.AUTO && (
              <div>
                <Label htmlFor="acmeEmail">ACME contact email</Label>
                <Input
                  id="acmeEmail"
                  type="email"
                  placeholder="security@example.com"
                  value={acmeEmail}
                  onChange={(e) => setAcmeEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional but recommended — Let's Encrypt emails expiry
                  warnings here. Not shared publicly.
                </p>
              </div>
            )}

            {mode === HostnameMode.BYOC && (
              <div className="space-y-4">
                <FileField
                  label="Certificate (PEM)"
                  value={cert}
                  onChange={setCert}
                  required
                  description="Public cert, starts with -----BEGIN CERTIFICATE-----."
                />
                <FileField
                  label="Private key (PEM)"
                  value={key}
                  onChange={setKey}
                  required
                  description="Unencrypted private key — uploaded over HTTPS, stored with 0600 perms, never logged."
                />
                <FileField
                  label="Intermediate chain (PEM, optional)"
                  value={chain}
                  onChange={setChain}
                  description="Concatenated intermediate CA certs if your CA doesn't ship them with the leaf."
                />
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    The private key is validated and written to a shared Docker
                    volume readable only by the Caddy container. It is never
                    stored in the database and never returned to the browser.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={save.isPending}
              >
                {save.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Applying…
                  </>
                ) : (
                  "Save & apply"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
