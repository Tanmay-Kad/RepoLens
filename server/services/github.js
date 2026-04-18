const { Octokit } = require("@octokit/rest");

const ALLOWED_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".py", ".mjs", ".cjs"]);
const SKIP_DIRS = ["node_modules", ".git", "dist", "build", "__pycache__", ".next", "coverage"];
const MAX_FILES = 200;

function parseGitHubUrl(repoUrl) {
  try {
    const url = new URL(repoUrl);
    if (!url.hostname.includes("github.com")) {
      throw new Error("Invalid GitHub URL");
    }
    const [owner, repo] = url.pathname.replace(/^\/+/, "").split("/");
    if (!owner || !repo) throw new Error("Invalid repository path");
    return { owner, repo: repo.replace(".git", "") };
  } catch (_error) {
    const err = new Error("Please provide a valid GitHub repository URL");
    err.status = 400;
    throw err;
  }
}

function shouldInclude(path) {
  const lower = path.toLowerCase();
  if (SKIP_DIRS.some((segment) => lower.includes(`/${segment.toLowerCase()}/`) || lower.startsWith(`${segment.toLowerCase()}/`))) {
    return false;
  }
  const dot = path.lastIndexOf(".");
  if (dot === -1) return false;
  return ALLOWED_EXTENSIONS.has(path.slice(dot));
}

function getLanguage(path) {
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  return "javascript";
}

async function fetchRepositoryFiles(repoUrl) {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN || undefined
  });

  try {
    const repoData = await octokit.repos.get({ owner, repo });
    const branch = repoData.data.default_branch;
    const tree = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: branch,
      recursive: "true"
    });

    const sourceFiles = tree.data.tree
      .filter((item) => item.type === "blob" && shouldInclude(item.path))
      .slice(0, MAX_FILES);

    if (sourceFiles.length === MAX_FILES && tree.data.tree.filter((item) => item.type === "blob" && shouldInclude(item.path)).length > MAX_FILES) {
      const err = new Error("Repo too large. Try a smaller repo.");
      err.status = 400;
      throw err;
    }

    const files = {};
    for (const file of sourceFiles) {
      const contentResp = await octokit.repos.getContent({
        owner,
        repo,
        path: file.path
      });
      if (!("content" in contentResp.data)) continue;
      files[file.path] = {
        content: Buffer.from(contentResp.data.content, "base64").toString("utf8"),
        size: contentResp.data.size || 0,
        language: getLanguage(file.path)
      };
    }

    return {
      repoName: `${owner}/${repo}`,
      files
    };
  } catch (error) {
    if (error.status === 404) {
      const err = new Error("Repository not found");
      err.status = 404;
      throw err;
    }
    if (error.status === 403) {
      const message = String(error.message || "").toLowerCase().includes("rate limit")
        ? "GitHub rate limit hit. Add a GITHUB_TOKEN to increase limits."
        : "This repo is private. Add a GitHub token.";
      const err = new Error(message);
      err.status = String(message).includes("rate limit") ? 429 : 403;
      throw err;
    }
    throw error;
  }
}

module.exports = { fetchRepositoryFiles, parseGitHubUrl, MAX_FILES };
