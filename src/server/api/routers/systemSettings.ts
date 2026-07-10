/**
 * System-level deployment settings (not org-scoped).
 *
 * Currently: hostname + TLS config for the Caddy reverse proxy.
 * ORG_ADMIN only.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { HostnameMode } from "@prisma/client";
import { createTRPCRouter, organizationProcedure } from "@/server/api/trpc";
import { UserRole } from "@prisma/client";
import {
  validateCertKeyPair,
  isValidHostname,
} from "@/lib/pem-validation";
import {
  writeCertFiles,
  removeCertFiles,
  applyConfigToCaddy,
} from "@/server/services/hostname-config.service";

/** Singleton row id — lookup key, not exposed in the API. */
const SINGLETON_ID = "hostname-config-singleton";

function assertAdmin(role: string | undefined): void {
  if (role !== UserRole.ADMINISTRATOR) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only organization administrators can change deployment settings",
    });
  }
}

export const systemSettingsRouter = createTRPCRouter({
  /**
   * Current hostname config, if any. Null on first boot.
   */
  getHostnameConfig: organizationProcedure.query(async ({ ctx }) => {
    const config = await ctx.db.hostnameConfig.findUnique({
      where: { id: SINGLETON_ID },
    });
    return config;
  }),

  /**
   * Update hostname + TLS mode. For BYOC, cert/key PEMs are provided inline
   * (base64-decoded client-side → plain string here). Atomic: validation
   * failures prevent any DB write or file write.
   */
  updateHostname: organizationProcedure
    .input(
      z
        .object({
          hostname: z
            .string()
            .min(1, "Hostname is required")
            .max(253)
            .refine((h) => isValidHostname(h), {
              message:
                "Invalid hostname — use a bare DNS name (e.g., grc.example.com)",
            }),
          mode: z.nativeEnum(HostnameMode),
          acmeEmail: z
            .string()
            .email()
            .max(254)
            .optional()
            .or(z.literal("")),
          certPem: z.string().optional(),
          keyPem: z.string().optional(),
          chainPem: z.string().optional(),
        })
        .superRefine((val, ctx) => {
          if (val.mode === HostnameMode.BYOC) {
            if (!val.certPem || !val.keyPem) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                  "Bring-your-own-cert mode requires both certificate and private key",
                path: ["certPem"],
              });
            }
          }
        })
    )
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.session?.user.role);

      let certNotAfter: Date | null = null;
      let certSANs: string[] = [];
      let hasCertFiles = false;

      if (input.mode === HostnameMode.BYOC) {
        const result = validateCertKeyPair({
          certPem: input.certPem!,
          keyPem: input.keyPem!,
          expectedHostname: input.hostname,
        });

        if (!result.ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Certificate validation failed:\n${result.errors.join("\n")}`,
          });
        }

        certNotAfter = result.metadata!.notAfter;
        certSANs = result.metadata!.subjectAltNames;

        await writeCertFiles({
          certPem: input.certPem!,
          keyPem: input.keyPem!,
          chainPem: input.chainPem?.trim() || null,
        });
        hasCertFiles = true;
      } else {
        // AUTO mode — remove any stale cert files
        await removeCertFiles();
      }

      const now = new Date();

      const savedConfig = await ctx.db.hostnameConfig.upsert({
        where: { id: SINGLETON_ID },
        create: {
          id: SINGLETON_ID,
          hostname: input.hostname,
          mode: input.mode,
          acmeEmail:
            input.mode === HostnameMode.AUTO
              ? input.acmeEmail?.trim() || null
              : null,
          certNotAfter,
          certSANs,
          hasCertFiles,
          lastAppliedAt: null,
          lastAppliedOk: false,
          lastApplyError: null,
          updatedAt: now,
          updatedById: ctx.session!.user.id,
        },
        update: {
          hostname: input.hostname,
          mode: input.mode,
          acmeEmail:
            input.mode === HostnameMode.AUTO
              ? input.acmeEmail?.trim() || null
              : null,
          certNotAfter,
          certSANs,
          hasCertFiles,
          updatedAt: now,
          updatedById: ctx.session!.user.id,
        },
      });

      const applyResult = await applyConfigToCaddy(savedConfig);

      await ctx.db.hostnameConfig.update({
        where: { id: SINGLETON_ID },
        data: {
          lastAppliedAt: now,
          lastAppliedOk: applyResult.ok,
          lastApplyError: applyResult.ok ? null : applyResult.error ?? null,
        },
      });

      return {
        savedConfig,
        applied: applyResult.ok,
        caddyReachable: applyResult.caddyReachable,
        error: applyResult.error,
      };
    }),
});
