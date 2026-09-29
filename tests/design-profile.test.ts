import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { sha256Bytes } from "../src/environment/hash.ts";
import { resolveDesignProfile, toModelDesignProfile } from "../src/design-profile/index.ts";

const templateRoot = join(dirname(fileURLToPath(import.meta.url)), "../templates/dorkflow-design-atlas-template");

async function createProfileRepo(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), "dorkflow-profile-test-"));
  try {
    await cp(templateRoot, root, { recursive: true });
    const git = (args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
    git(["init", "--quiet"]);
    git(["config", "user.name", "Dorkflow Tests"]);
    git(["config", "user.email", "dorkflow-tests@example.invalid"]);
    git(["add", "--all"]);
    git(["commit", "--quiet", "-m", "freeze test profile"]);
    return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe("local Git-backed Design Profile", () => {
  test("loads the staged starter, pins the commit, and hashes every consumed file stably", async () => {
    const repo = await createProfileRepo();
    try {
      const first = await resolveDesignProfile(repo.root);
      const second = await resolveDesignProfile(repo.root);

      expect(first.manifest.profileId).toBe("dorkflow-design-atlas");
      expect(first.floor.length).toBeGreaterThan(0);
      expect(first.rails.length).toBeGreaterThan(0);
      expect(first.compass.principles.length).toBeGreaterThan(0);
      expect(first.atlas.length).toBeGreaterThan(0);
      expect(first.antiReferences.length).toBeGreaterThan(0);
      expect(first.provenance.worktreeState).toBe("clean");
      expect(first.provenance.revision).toBe(
        execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo.root, encoding: "utf8" }).trim(),
      );
      expect(first.provenance.files.map(({ path }) => path)).toContain("profile.json");
      expect(first.provenance.profileSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(second.provenance).toEqual(first.provenance);
      const floorBytes = await readFile(join(repo.root, "floor/core.json"));
      expect(first.provenance.files.find(({ path }) => path === "floor/core.json")?.sha256)
        .toBe(sha256Bytes(floorBytes));

      const modelProfile = toModelDesignProfile(first);
      expect(modelProfile.floor).toEqual(first.floor);
      expect(modelProfile.rails).toEqual(first.rails);
      expect(modelProfile.compass).toEqual(first.compass);
      expect(JSON.stringify(modelProfile)).not.toContain("Common Thread Reading Room");
      expect(JSON.stringify(modelProfile)).not.toContain("Harbor Operations Wallboard");
    } finally {
      await repo.cleanup();
    }
  });

  test("works with no personal Atlas references", async () => {
    const repo = await createProfileRepo();
    try {
      const manifest = await readJson(join(repo.root, "profile.json"));
      manifest.atlasFiles = [];
      await writeJson(join(repo.root, "profile.json"), manifest);

      const result = await resolveDesignProfile(repo.root);
      expect(result.atlas).toEqual([]);
      expect(toModelDesignProfile(result).compass.principles.length).toBeGreaterThan(0);
    } finally {
      await repo.cleanup();
    }
  });

  test("fails clearly when required profile metadata is absent", async () => {
    const repo = await createProfileRepo();
    try {
      const manifest = await readJson(join(repo.root, "profile.json"));
      delete manifest.name;
      await writeJson(join(repo.root, "profile.json"), manifest);
      await expect(resolveDesignProfile(repo.root)).rejects.toThrow("profile.json");
    } finally {
      await repo.cleanup();
    }
  });

  test("rejects malformed Floor, Rail, and Atlas reference records", async () => {
    const cases = [
      {
        path: "floor/core.json",
        expected: "floor/core.json",
        mutate: (value: Record<string, unknown>) => {
          const requirements = value.requirements as Record<string, unknown>[];
          delete requirements[0]!.rationale;
        },
      },
      {
        path: "rails/project-rails.json",
        expected: "rails/project-rails.json",
        mutate: (value: Record<string, unknown>) => {
          const rails = value.rails as Record<string, unknown>[];
          delete rails[0]!.escapeCondition;
        },
      },
      {
        path: "atlas/common-thread-reading-room.json",
        expected: "atlas/common-thread-reading-room.json",
        mutate: (value: Record<string, unknown>) => {
          delete value.underlyingPrinciple;
        },
      },
    ];

    for (const item of cases) {
      const repo = await createProfileRepo();
      try {
        const value = await readJson(join(repo.root, item.path));
        item.mutate(value);
        await writeJson(join(repo.root, item.path), value);
        await expect(resolveDesignProfile(repo.root)).rejects.toThrow(item.expected);
      } finally {
        await repo.cleanup();
      }
    }
  });

  test("reports tracked and untracked edits as dirty without changing the pinned HEAD", async () => {
    const repo = await createProfileRepo();
    try {
      const frozenHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo.root, encoding: "utf8" }).trim();
      const manifest = await readJson(join(repo.root, "profile.json"));
      manifest.description = "Edited but still valid.";
      await writeJson(join(repo.root, "profile.json"), manifest);
      await writeFile(join(repo.root, "notes.txt"), "Untracked local note.\n");

      const result = await resolveDesignProfile(repo.root);
      expect(result.provenance.worktreeState).toBe("dirty");
      expect(result.provenance.revision).toBe(frozenHead);
      expect(result.provenance.profileSha256).not.toBe("0".repeat(64));
    } finally {
      await repo.cleanup();
    }
  });

  test("rejects traversal and symlinked profile inputs", async () => {
    const repo = await createProfileRepo();
    try {
      const manifest = await readJson(join(repo.root, "profile.json"));
      manifest.floorFiles = ["../outside.json"];
      await writeJson(join(repo.root, "profile.json"), manifest);
      await expect(resolveDesignProfile(repo.root)).rejects.toThrow("relative POSIX paths");
    } finally {
      await repo.cleanup();
    }

    const linkedRepo = await createProfileRepo();
    try {
      await symlink(join(linkedRepo.root, "rails/project-rails.json"), join(linkedRepo.root, "floor/linked.json"));
      const manifest = await readJson(join(linkedRepo.root, "profile.json"));
      manifest.floorFiles = ["floor/linked.json"];
      await writeJson(join(linkedRepo.root, "profile.json"), manifest);
      await expect(resolveDesignProfile(linkedRepo.root)).rejects.toThrow("does not allow symlinks");
    } finally {
      await linkedRepo.cleanup();
    }
  });

  test("requires a committed local Git working tree", async () => {
    const root = await mkdtemp(join(tmpdir(), "dorkflow-profile-no-git-"));
    try {
      await cp(templateRoot, root, { recursive: true });
      await expect(resolveDesignProfile(root)).rejects.toThrow("local Git working tree with a commit");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
