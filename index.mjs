import { Octokit } from "octokit";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import fs, { mkdir, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const MyOctokit = Octokit.plugin(paginateRest);
const octokit = new MyOctokit({ auth: process.env.GITHUB_TOKEN });

const result = await octokit.paginate(`GET /user/repos`, {
  type: "owner",
  per_page: 50,
});
await processRepositories(result);

function bundleRepository(repository) {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const { full_name, clone_url } = repository;

  const fullPath = path.join(dirname, full_name);
  const clonePath = path.join(dirname, full_name, "cloned");
  const bundleName = `${
    full_name.split("/")[1]
  }-${new Date().getTime()}.bundle`;

  mkdirSync(fullPath, { recursive: true });

  fs.rmSync(clonePath, { recursive: true, force: true });
  mkdirSync(clonePath, { recursive: true });

  try {
    console.log(`Cloning ${full_name} into ${clonePath}`);
    process.chdir(clonePath);
    execSync(`git clone --mirror ${clone_url} .`);
    execSync(`git bundle create ${bundleName} --all`);
    process.chdir(dirname);

    fs.renameSync(
      path.join(clonePath, bundleName),
      path.join(fullPath, bundleName)
    );
    fs.rmSync(clonePath, {
      recursive: true,
      force: true,
      maxRetries: 10,
    });
  } catch (e) {
    console.error(e);
  }
}

async function processRepositories(repositories) {
  for (const repository of repositories) {
    bundleRepository(repository);
  }
}
