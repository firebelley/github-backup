import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import { Octokit } from "octokit";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import fs, { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

dotenv.config();

const MyOctokit = Octokit.plugin(paginateRest);
const octokit = new MyOctokit({ auth: process.env.GITHUB_TOKEN });

const result = await octokit.paginate(`GET /user/repos`, {
  type: "owner",
  per_page: 50,
});
await processRepositories(result);

function isBackupUpToDate(existingBundles, latestDate) {
  return Object.keys(existingBundles).some((existingBundle) =>
    existingBundle.includes(`${latestDate}`)
  );
}

function getExistingBundles(bundlePath) {
  const files = fs.readdirSync(bundlePath);
  const stats = files
    .filter((x) => x.endsWith(".bundle"))
    .reduce(
      (total, current) => ({
        ...total,
        [current]: {
          date: parseInt(current.split("-").at(-1).replace(".bundle", ""), 10),
          stats: fs.statSync(path.join(bundlePath, current)),
        },
      }),
      {}
    );
  return stats;
}

function cleanBundles(bundlePath, existingBundles) {
  if (Object.keys(existingBundles).length + 1 <= 5) return;
  const bundlesAscending = Object.keys(existingBundles).map((key) => ({
    name: key,
    bundle: existingBundles[key],
  }));
  bundlesAscending.sort((a, b) => {
    return a.bundle.date - b.bundle.date;
  });
  console.log("Pruning backups");
  const prunePath = path.join(bundlePath, bundlesAscending[0].name);
  fs.unlinkSync(prunePath);
  console.log(`Pruned ${prunePath}`);
}

function bundleRepository(repository) {
  const dirname =
    process.env.BACKUP_PATH || path.dirname(fileURLToPath(import.meta.url));
  const { full_name, clone_url, ssh_url, pushed_at } = repository;

  const bundlePath = path.join(dirname, full_name);
  const cloneRepoPath = path.join(dirname, full_name, "cloned");

  const latestDate = Date.parse(pushed_at);
  const bundleName = `${full_name.split("/")[1]}-${latestDate}.bundle`;

  mkdirSync(bundlePath, { recursive: true });
  fs.rmSync(cloneRepoPath, { recursive: true, force: true });

  const existingBundles = getExistingBundles(bundlePath);
  if (isBackupUpToDate(existingBundles, latestDate)) {
    console.log(
      `Repository ${full_name} backup is up-to-date. Skipping bundle step.`
    );
    return;
  }

  mkdirSync(cloneRepoPath, { recursive: true });

  try {
    console.log(`Cloning ${full_name} into ${cloneRepoPath}`);
    process.chdir(cloneRepoPath);
    const url = process.env.USE_SSH_URL === "true" ? ssh_url : clone_url;
    execSync(`git clone --mirror ${url} .`);
    execSync(`git bundle create ${bundleName} --all`);
    process.chdir(dirname);

    fs.renameSync(
      path.join(cloneRepoPath, bundleName),
      path.join(bundlePath, bundleName)
    );
    fs.rmSync(cloneRepoPath, {
      recursive: true,
      force: true,
      maxRetries: 10,
    });

    cleanBundles(bundlePath, existingBundles);
  } catch (e) {
    console.error(e);
    throw e;
  }
}

async function processRepositories(repositories) {
  for (const repository of repositories) {
    bundleRepository(repository);
    break;
  }
}
