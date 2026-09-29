import { z } from "zod";
import { Sha256, ShortText } from "./common.ts";

export const ProfileItemId = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).max(80);

/** Local POSIX-style paths only; resolution additionally rejects symlinks and escapes. */
export const DesignProfileFilePath = z.string().min(1).max(240).refine((value) => {
  if (value.startsWith("/") || value.includes("\\") || value.includes("\0")) return false;
  return value.split("/").every((part) =>
    part.length > 0 && part !== "." && part !== ".." && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part),
  );
}, "Profile file paths must be normalized, relative POSIX paths without traversal");

export const DesignProfileManifest = z.object({
  schemaVersion: z.literal(1),
  profileId: ProfileItemId,
  name: ShortText,
  description: ShortText,
  floorFiles: z.array(DesignProfileFilePath).min(1).max(32),
  railFiles: z.array(DesignProfileFilePath).min(1).max(32),
  compassFile: DesignProfileFilePath,
  atlasFiles: z.array(DesignProfileFilePath).max(256),
  antiReferenceFiles: z.array(DesignProfileFilePath).max(128),
}).strict().superRefine((manifest, context) => {
  const paths = [
    ...manifest.floorFiles,
    ...manifest.railFiles,
    manifest.compassFile,
    ...manifest.atlasFiles,
    ...manifest.antiReferenceFiles,
  ];
  const seen = new Set<string>(["profile.json"]);
  for (const [index, path] of paths.entries()) {
    if (seen.has(path)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["files", index],
        message: `Profile input path is listed more than once: ${path}`,
      });
    }
    seen.add(path);
  }
});

const FloorRequirement = z.object({
  id: ProfileItemId,
  principle: ShortText,
  requirement: ShortText,
  rationale: ShortText,
}).strict();

export const DesignProfileFloorDocument = z.object({
  schemaVersion: z.literal(1),
  id: ProfileItemId,
  name: ShortText,
  requirements: z.array(FloorRequirement).min(1).max(64),
}).strict().superRefine((document, context) => {
  const ids = document.requirements.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["requirements"], message: "Floor requirement IDs must be unique" });
  }
});

const DesignRail = z.object({
  id: ProfileItemId,
  principle: ShortText,
  recommendation: ShortText,
  context: ShortText,
  escapeCondition: ShortText,
}).strict();

export const DesignProfileRailDocument = z.object({
  schemaVersion: z.literal(1),
  id: ProfileItemId,
  name: ShortText,
  rails: z.array(DesignRail).min(1).max(64),
}).strict().superRefine((document, context) => {
  const ids = document.rails.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["rails"], message: "Rail IDs must be unique" });
  }
});

export const DesignProfileCompassDocument = z.object({
  schemaVersion: z.literal(1),
  id: ProfileItemId,
  name: ShortText,
  northStar: ShortText,
  principles: z.array(z.object({
    id: ProfileItemId,
    principle: ShortText,
    guidance: ShortText,
  }).strict()).min(1).max(64),
}).strict().superRefine((document, context) => {
  const ids = document.principles.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["principles"], message: "Compass principle IDs must be unique" });
  }
});

const AttributedAspect = z.object({
  aspect: ShortText,
  reason: ShortText,
}).strict();

export const DesignAtlasReference = z.object({
  schemaVersion: z.literal(1),
  id: ProfileItemId,
  title: ShortText,
  source: z.object({
    type: z.enum(["site", "application", "book", "film", "object", "fictional", "fictional-original", "other"]),
    name: ShortText,
    dateOrEra: ShortText.optional(),
    location: ShortText.optional(),
  }).strict(),
  humanReaction: ShortText,
  borrow: z.array(AttributedAspect).min(1).max(24),
  doNotBorrow: z.array(AttributedAspect).max(24),
  underlyingPrinciple: ShortText,
  modernTranslation: ShortText,
  tags: z.array(ProfileItemId).max(32),
}).strict();

export const DesignAntiReference = z.object({
  schemaVersion: z.literal(1),
  id: ProfileItemId,
  title: ShortText,
  source: z.object({
    type: z.enum(["site", "application", "book", "film", "object", "fictional", "fictional-original", "other"]),
    name: ShortText,
  }).strict().optional(),
  rationale: ShortText,
  techniqueNotUniversallyBanned: ShortText,
}).strict();

export const DesignProfileFileDigest = z.object({
  path: DesignProfileFilePath,
  sha256: Sha256,
}).strict();

export const DesignProfileProvenance = z.object({
  sourceKind: z.literal("git-worktree"),
  profileId: ProfileItemId,
  revision: z.string().regex(/^[a-f0-9]{40,64}$/),
  worktreeState: z.enum(["clean", "dirty"]),
  profileSha256: Sha256,
  files: z.array(DesignProfileFileDigest).min(2),
}).strict().superRefine((provenance, context) => {
  const paths = provenance.files.map(({ path }) => path);
  if (new Set(paths).size !== paths.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["files"], message: "Profile provenance paths must be unique" });
  }
  if (!paths.includes("profile.json")) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["files"], message: "Profile provenance must hash profile.json" });
  }
});

/** The only profile material passed to a design-stage model; atlas entries are intentionally absent. */
export const ModelDesignProfile = z.object({
  schemaVersion: z.literal(1),
  profileId: ProfileItemId,
  provenance: DesignProfileProvenance,
  floor: z.array(DesignProfileFloorDocument).min(1),
  rails: z.array(DesignProfileRailDocument).min(1),
  compass: DesignProfileCompassDocument,
}).strict().refine((profile) => profile.provenance.profileId === profile.profileId, {
  message: "Profile provenance must identify the supplied profile",
  path: ["provenance", "profileId"],
});

export type DesignProfileManifest = z.infer<typeof DesignProfileManifest>;
export type DesignProfileFloorDocument = z.infer<typeof DesignProfileFloorDocument>;
export type DesignProfileRailDocument = z.infer<typeof DesignProfileRailDocument>;
export type DesignProfileCompassDocument = z.infer<typeof DesignProfileCompassDocument>;
export type DesignAtlasReference = z.infer<typeof DesignAtlasReference>;
export type DesignAntiReference = z.infer<typeof DesignAntiReference>;
export type DesignProfileProvenance = z.infer<typeof DesignProfileProvenance>;
export type ModelDesignProfile = z.infer<typeof ModelDesignProfile>;
