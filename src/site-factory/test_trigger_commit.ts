import { readFileSync } from "node:fs";

const envContent = readFileSync(".env", "utf-8");

function getEnvVar(name: string): string {
  const m = envContent.match(new RegExp(`^${name}=["']?([^"'\\r\\n]+)`, "m"));
  return m ? m[1].trim() : "";
}

const GITHUB_PAT = getEnvVar("GITHUB_PAT");
const GITHUB_OWNER = getEnvVar("GITHUB_OWNER") || "aroragroupindiamart-gif";

async function testTriggerCommit() {
  const repo = "am-plumbing-repair";
  console.log(`[1] Fetching README.md for ${repo}...`);
  
  const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${repo}/contents/README.md`, {
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Antigravity"
    }
  });

  const fileData = await res.json() as any;
  console.log("README sha:", fileData.sha);
  const currentContent = Buffer.from(fileData.content, "base64").toString("utf-8");
  
  // Append a small timestamp comment to trigger GitHub Actions push event
  const newContent = currentContent + `\n<!-- Phone update trigger: ${Date.now()} -->\n`;
  
  console.log(`[2] Pushing commit to main branch of ${repo}...`);
  const putRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${repo}/contents/README.md`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "Antigravity"
    },
    body: JSON.stringify({
      message: "chore: update phone number configuration",
      content: Buffer.from(newContent, "utf-8").toString("base64"),
      sha: fileData.sha
    })
  });

  const putData = await putRes.json() as any;
  console.log("Commit status:", putRes.status, "Commit SHA:", putData.commit?.sha);

  // Check if GitHub Actions workflow started!
  console.log(`[3] Checking workflow runs for ${repo}...`);
  await new Promise(r => setTimeout(r, 4000));
  const runsRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${repo}/actions/runs`, {
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Antigravity"
    }
  });
  const runsData = await runsRes.json() as any;
  console.log("Workflow runs count:", runsData.total_count);
  if (runsData.workflow_runs && runsData.workflow_runs.length > 0) {
    const latest = runsData.workflow_runs[0];
    console.log(`Latest Run: #${latest.run_number} (${latest.name}) - Status: ${latest.status}`);
  }
}

testTriggerCommit();
