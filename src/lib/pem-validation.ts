/**
 * PEM certificate + private-key validation.
 *
 * Uses node:crypto's X509Certificate (Node 15+) to parse and inspect certs,
 * and a sign/verify roundtrip to confirm the private key matches the cert's
 * public key. No external deps.
 */

import crypto, {
  X509Certificate,
  createPrivateKey,
  createPublicKey,
} from "node:crypto";

export interface CertMetadata {
  subjectCN: string | null;
  subjectAltNames: string[];
  notBefore: Date;
  notAfter: Date;
  issuerCN: string | null;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  metadata?: CertMetadata;
}

/** Minimum grace window for accepting a cert — reject if expires within this. */
const MIN_REMAINING_MS = 7 * 24 * 60 * 60 * 1000;

function extractCN(dn: string | undefined | null): string | null {
  if (!dn) return null;
  const match = dn.match(/CN=([^,\n]+)/i);
  return match?.[1]?.trim() ?? null;
}

function parseSubjectAltNames(cert: X509Certificate): string[] {
  // subjectAltName format: "DNS:example.com, DNS:www.example.com, IP Address:1.2.3.4"
  const san = cert.subjectAltName;
  if (!san) return [];
  return san
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.toUpperCase().startsWith("DNS:"))
    .map((entry) => entry.slice(4).trim().toLowerCase());
}

/** Parse a PEM certificate. Throws on malformed input. */
export function parseCertificate(pem: string): {
  cert: X509Certificate;
  metadata: CertMetadata;
} {
  const cert = new X509Certificate(pem);
  return {
    cert,
    metadata: {
      subjectCN: extractCN(cert.subject),
      subjectAltNames: parseSubjectAltNames(cert),
      notBefore: new Date(cert.validFrom),
      notAfter: new Date(cert.validTo),
      issuerCN: extractCN(cert.issuer),
    },
  };
}

/**
 * Verify the PEM private key matches the PEM certificate's public key.
 * Does a sign/verify roundtrip with a random nonce — if it succeeds, the
 * pair is valid.
 */
export function verifyKeyPair(certPem: string, keyPem: string): boolean {
  let certPubKey;
  let privKey;
  try {
    const cert = new X509Certificate(certPem);
    certPubKey = cert.publicKey;
    privKey = createPrivateKey(keyPem);
  } catch {
    return false;
  }

  // Sign a random nonce with the private key, verify with the cert's pubkey
  const nonce = crypto.randomBytes(32);

  try {
    const signature = crypto.sign(null, nonce, privKey);
    return crypto.verify(null, nonce, createPublicKey(certPubKey), signature);
  } catch {
    // Some algorithms (RSA without hash, etc.) need explicit digest
    try {
      const signature = crypto.sign("sha256", nonce, privKey);
      return crypto.verify(
        "sha256",
        nonce,
        createPublicKey(certPubKey),
        signature
      );
    } catch {
      return false;
    }
  }
}

/**
 * Full validation: parse cert, parse key, verify pair, check expiry, verify
 * the expected hostname is covered by CN or SANs. Returns all errors at
 * once so the UI can display a complete list.
 */
export function validateCertKeyPair(args: {
  certPem: string;
  keyPem: string;
  expectedHostname: string;
}): ValidationResult {
  const errors: string[] = [];
  let metadata: CertMetadata | undefined;

  try {
    const parsed = parseCertificate(args.certPem);
    metadata = parsed.metadata;

    const now = Date.now();
    const notBefore = parsed.metadata.notBefore.getTime();
    const notAfter = parsed.metadata.notAfter.getTime();

    if (notBefore > now) {
      errors.push(
        `Certificate not yet valid (notBefore ${parsed.metadata.notBefore.toISOString()})`
      );
    }
    if (notAfter < now) {
      errors.push(
        `Certificate expired on ${parsed.metadata.notAfter.toISOString()}`
      );
    } else if (notAfter - now < MIN_REMAINING_MS) {
      errors.push(
        `Certificate expires in less than 7 days (${parsed.metadata.notAfter.toISOString()})`
      );
    }

    const expected = args.expectedHostname.toLowerCase();
    const sanMatch = parsed.metadata.subjectAltNames.some(
      (san) => san === expected || matchesWildcard(san, expected)
    );
    const cnMatch =
      parsed.metadata.subjectCN?.toLowerCase() === expected ||
      (parsed.metadata.subjectCN &&
        matchesWildcard(parsed.metadata.subjectCN.toLowerCase(), expected));
    if (!sanMatch && !cnMatch) {
      errors.push(
        `Certificate does not cover hostname "${args.expectedHostname}" — SANs: [${parsed.metadata.subjectAltNames.join(", ") || "none"}], CN: ${parsed.metadata.subjectCN ?? "none"}`
      );
    }
  } catch (e) {
    errors.push(
      `Failed to parse certificate: ${e instanceof Error ? e.message : "unknown error"}`
    );
  }

  try {
    createPrivateKey(args.keyPem);
  } catch (e) {
    errors.push(
      `Failed to parse private key: ${e instanceof Error ? e.message : "unknown error"}`
    );
  }

  // Only run the pair check if both halves parsed cleanly
  if (errors.length === 0 || errors.every((e) => e.startsWith("Certificate expires"))) {
    if (!verifyKeyPair(args.certPem, args.keyPem)) {
      errors.push("Private key does not match certificate");
    }
  }

  return { ok: errors.length === 0, errors, metadata };
}

/**
 * Match a wildcard SAN/CN (e.g., "*.example.com") against a hostname.
 * Wildcards only match one level — "*.example.com" matches "foo.example.com"
 * but NOT "foo.bar.example.com" — per RFC 6125.
 */
function matchesWildcard(pattern: string, hostname: string): boolean {
  if (!pattern.startsWith("*.")) return false;
  const suffix = pattern.slice(1); // ".example.com"
  if (!hostname.endsWith(suffix)) return false;
  const leftPart = hostname.slice(0, hostname.length - suffix.length);
  return leftPart.length > 0 && !leftPart.includes(".");
}

/** Lenient hostname check — DNS label format, no protocol, no path. */
export function isValidHostname(hostname: string): boolean {
  if (!hostname || hostname.length > 253) return false;
  // No scheme, no path, no port
  if (/^https?:\/\//i.test(hostname)) return false;
  if (hostname.includes("/") || hostname.includes(":")) return false;
  // One or more DNS labels separated by dots
  const labelPattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
  return hostname.split(".").every((label) => labelPattern.test(label));
}
