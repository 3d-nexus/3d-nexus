import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const packageDirs = [
  "packages/nexus-core",
  "packages/nexus-obj",
  "packages/nexus-bvh",
  "packages/nexus-mmd",
  "packages/nexus-fbx",
  "packages/nexus-converter",
];

const versions = new Set(
  packageDirs.map((dir) => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), dir, "package.json"), "utf8"));
    return pkg.version;
  }),
);

if (versions.size !== 1) {
  console.error(`Expected a single release version across packages, got: ${Array.from(versions).join(", ")}`);
  process.exit(1);
}

const [version] = versions;
const tagName = `v${version}`;

const tagExists = spawnSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tagName}`], {
  stdio: "ignore",
});

if (tagExists.status === 0) {
  console.log(`Tag ${tagName} already exists.`);
  process.exit(0);
}

const createTag = spawnSync("git", ["tag", "-a", tagName, "-m", `Release ${tagName}`], {
  stdio: "inherit",
});

if (createTag.status !== 0) {
  process.exit(createTag.status ?? 1);
}

console.log(`Created tag ${tagName}.`);
