/**
 * Hostname + TLS config application.
 *
 * Responsibilities:
 *   - Render a Caddy JSON config (not Caddyfile — JSON posts directly to the
 *     admin API with no adapter required).
 *   - Write BYOC cert/key files to the shared `hostname_config` volume with
 *     0600 perms.
 *   - POST the rendered config to Caddy's admin endpoint; graceful fallback
 *     when Caddy isn't running (dev mode / --profile != production).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { HostnameMode, type HostnameConfig } from "@prisma/client";

/**
 * Where the app writes cert/key files. Matches the volume mount in
 * docker-compose.yml: app sees `/app/hostname-config`, Caddy sees
 * `/etc/caddy/dynamic`, same underlying volume.
 */
export const APP_HOSTNAME_DIR =
  process.env.HOSTNAME_CONFIG_DIR ?? "/app/hostname-config";

/** Caddy's view of the same volume. */
export const CADDY_CERT_DIR = "/etc/caddy/dynamic";

export const CADDY_ADMIN_URL =
  process.env.CADDY_ADMIN_URL ?? "http://caddy:2019";

export const CERT_FILENAME = "cert.pem";
export const KEY_FILENAME = "key.pem";
export const CHAIN_FILENAME = "chain.pem";

export interface ApplyResult {
  ok: boolean;
  caddyReachable: boolean;
  error?: string;
}

export async function ensureHostnameDir(): Promise<void> {
  await fs.mkdir(APP_HOSTNAME_DIR, { recursive: true, mode: 0o700 });
}

export async function writeCertFiles(args: {
  certPem: string;
  keyPem: string;
  chainPem?: string | null;
}): Promise<void> {
  await ensureHostnameDir();
  const certPath = path.join(APP_HOSTNAME_DIR, CERT_FILENAME);
  const keyPath = path.join(APP_HOSTNAME_DIR, KEY_FILENAME);
  const chainPath = path.join(APP_HOSTNAME_DIR, CHAIN_FILENAME);

  // Write cert bundle (cert + optional chain concatenated) so Caddy presents
  // the full chain to clients
  const certBundle = args.chainPem
    ? `${args.certPem.trim()}\n${args.chainPem.trim()}\n`
    : `${args.certPem.trim()}\n`;

  await fs.writeFile(certPath, certBundle, { mode: 0o600 });
  await fs.writeFile(keyPath, `${args.keyPem.trim()}\n`, { mode: 0o600 });

  if (args.chainPem) {
    await fs.writeFile(chainPath, `${args.chainPem.trim()}\n`, { mode: 0o600 });
  } else {
    // Clean up any stale chain from a previous cert
    await fs.rm(chainPath, { force: true });
  }
}

export async function removeCertFiles(): Promise<void> {
  const certPath = path.join(APP_HOSTNAME_DIR, CERT_FILENAME);
  const keyPath = path.join(APP_HOSTNAME_DIR, KEY_FILENAME);
  const chainPath = path.join(APP_HOSTNAME_DIR, CHAIN_FILENAME);
  await Promise.all([
    fs.rm(certPath, { force: true }),
    fs.rm(keyPath, { force: true }),
    fs.rm(chainPath, { force: true }),
  ]);
}

/**
 * Render a Caddy JSON config that
 *   - serves reverse_proxy → app:3000 on both :80 and :443
 *   - either loads a user-supplied cert (BYOC) or uses ACME (AUTO)
 * Ref: https://caddyserver.com/docs/json/
 */
export function renderCaddyConfig(cfg: HostnameConfig): unknown {
  const hostname = cfg.hostname;

  const tlsApp: Record<string, unknown> = {};

  if (cfg.mode === HostnameMode.BYOC) {
    tlsApp.certificates = {
      load_files: [
        {
          certificate: `${CADDY_CERT_DIR}/${CERT_FILENAME}`,
          key: `${CADDY_CERT_DIR}/${KEY_FILENAME}`,
          tags: ["byoc"],
        },
      ],
    };
    // Disable ACME for this host — use our uploaded cert
    tlsApp.automation = {
      policies: [
        {
          subjects: [hostname],
          issuers: [{ module: "internal" }],
          get_certificate: [{ via_storage: {} }],
        },
      ],
    };
  } else {
    // AUTO mode — Let's Encrypt via HTTP-01 challenge on port 80
    const issuer: Record<string, unknown> = { module: "acme" };
    if (cfg.acmeEmail) issuer.email = cfg.acmeEmail;

    tlsApp.automation = {
      policies: [
        {
          subjects: [hostname],
          issuers: [issuer],
        },
      ],
    };
  }

  return {
    admin: { listen: "0.0.0.0:2019" },
    apps: {
      http: {
        servers: {
          main: {
            listen: [":80", ":443"],
            routes: [
              {
                match: [{ host: [hostname] }],
                handle: [
                  {
                    handler: "reverse_proxy",
                    upstreams: [{ dial: "app:3000" }],
                  },
                ],
              },
            ],
          },
        },
      },
      tls: tlsApp,
    },
  };
}

/**
 * POST the rendered config to Caddy's admin API. If Caddy isn't reachable
 * (e.g., dev environment without --profile production), return
 * `caddyReachable=false` so the caller can warn rather than fail.
 */
export async function applyConfigToCaddy(
  cfg: HostnameConfig
): Promise<ApplyResult> {
  const body = JSON.stringify(renderCaddyConfig(cfg));

  let response: Response;
  try {
    response = await fetch(`${CADDY_ADMIN_URL}/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    return {
      ok: false,
      caddyReachable: false,
      error: e instanceof Error ? e.message : "network error",
    };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      caddyReachable: true,
      error: `Caddy rejected config (HTTP ${response.status}): ${text.slice(0, 500)}`,
    };
  }

  return { ok: true, caddyReachable: true };
}
