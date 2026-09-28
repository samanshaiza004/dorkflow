import { z } from "zod";

export const ViewportConfig = z
  .object({
    label: z.enum(["mobile", "tablet", "desktop"]),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

export const BrowserConfig = z
  .object({
    engine: z.literal("chromium"),
    playwrightVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    browserRevision: z.string().min(1),
    browserVersion: z.string().min(1),
    executableSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const RenderingEnvironment = z
  .object({
    schemaVersion: z.literal(1),
    packageManager: z.literal("bun@1.3.14"),
    bunVersion: z.string().min(1),
    nodeVersion: z.string().min(1),
    host: z
      .object({
        platform: z.string().min(1),
        architecture: z.string().min(1),
        osRelease: z.string().min(1),
        osVersion: z.string().min(1),
        osBuild: z.string().min(1),
        containerRuntime: z.enum(["host", "docker", "podman", "other"]),
        containerImageDigest: z.string().nullable(),
      })
      .strict(),
    browser: BrowserConfig,
    context: z
      .object({
        locale: z.string().min(1),
        timezoneId: z.string().min(1),
        deviceScaleFactor: z.number().positive(),
        colorScheme: z.enum(["light", "dark", "no-preference"]),
        reducedMotion: z.enum(["reduce", "no-preference"]),
        forcedColors: z.enum(["active", "none"]),
        contrast: z.enum(["more", "no-preference"]),
        javaScriptEnabled: z.boolean(),
        hasTouch: z.boolean(),
        isMobile: z.boolean(),
      })
      .strict(),
    viewports: z.array(ViewportConfig).min(3),
    fonts: z
      .object({
        directory: z.string().min(1),
        files: z.array(z.object({ name: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()),
        manifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    environmentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export type RenderingEnvironment = z.infer<typeof RenderingEnvironment>;
