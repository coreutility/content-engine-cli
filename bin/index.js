#!/usr/bin/env node
import axios from "axios";
import fs from "fs";
import path from "path";
import decompress from "decompress";
import prompts from "prompts";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
//set..
/*process.env.GITHUB_TOKEN = "";
process.env.GITHUB_AUTH = "0";*/
/* ------------------------------
   CONFIG: EDIT THIS
------------------------------ */
const GITHUB_OWNER = "coreutility";
const GITHUB_REPO = "content-engine";
const GITHUB_BRANCH = "main";
/* ------------------------------ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/* ------------------------------------------------
   Fetch template folder names from GitHub /templates
---------------------------------------------------*/
async function fetchTemplates() {
    let templates = ["vanilla-ts"]; // fallback
    try {
        //const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/templates`;
        const url = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/template-list.json`;
        //const url = `https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@${GITHUB_BRANCH}/template-list.json`;
        const res = await fetch(url);
        const data = await res.json();
        if (Array.isArray(data)) {
            templates = data
                .filter((i) => i.type === "dir")
                .map((i) => i.name);
        }
    }
    catch (err) {
        console.warn("⚠ Could not fetch templates from GitHub, using fallback.");
    }
    return templates;
}
/* ------------------------------------------------
   Download repo ZIP
---------------------------------------------------*/
async function downloadZip(zipPath) {
    const url = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/archive/refs/heads/${GITHUB_BRANCH}.zip`;
    //const url = `https://codeload.github.com/${GITHUB_OWNER}/${GITHUB_REPO}/zip/${GITHUB_BRANCH}`;
    //console.log(`fetching: ${url}`);
    const res = await axios.get(url, { responseType: "arraybuffer" });
    fs.writeFileSync(zipPath, res.data);
}
/* ------------------------------------------------
   MAIN
---------------------------------------------------*/
async function main() {
    const args = process.argv.slice(2);
    let projectName = args[0] || "";
    let templateName = null;
    // Parse flags
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--template") {
            templateName = args[i + 1];
        }
        else if (args[i].startsWith("--template=")) {
            templateName = args[i].split("=")[1];
        }
    }
    // Ask project name if missing
    if (!projectName) {
        const { value } = await prompts({
            type: "text",
            name: "value",
            message: "Project name:",
            validate: (v) => (v ? true : "Project name is required"),
        });
        projectName = value;
    }
    // Ask template if missing
    if (!templateName) {
        const templateList = await fetchTemplates();
        const { template } = await prompts({
            type: "select",
            name: "template",
            message: "Choose a template:",
            choices: templateList.map((t) => ({
                title: t.replace(/-/g, " ").toUpperCase(),
                value: t,
            })),
        });
        templateName = template;
    }
    console.log(`\n⏳ Downloading template…`);
    const zipFile = path.join(process.cwd(), "repo.zip");
    const extractDir = path.join(process.cwd(), ".__extract_ce_cli__");
    await downloadZip(zipFile);
    await decompress(zipFile, extractDir);
    // detect extracted folder
    const extractedRoot = fs.readdirSync(extractDir).find((f) => f.includes(GITHUB_REPO));
    if (!extractedRoot) {
        console.error("❌ Could not find extracted folder");
        process.exit(1);
    }
    const fullTemplatePath = path.join(extractDir, extractedRoot, "templates", templateName);
    if (!fs.existsSync(fullTemplatePath)) {
        console.error(`❌ Template not found: ${templateName}`);
        process.exit(1);
    }
    // create project
    fs.mkdirSync(projectName, { recursive: true });
    // copy files
    fs.cpSync(fullTemplatePath, projectName, { recursive: true });
    // cleanup
    fs.rmSync(zipFile, { force: true });
    fs.rmSync(extractDir, { recursive: true, force: true });
    console.log(`\n🎉 Project created: ${projectName}`);
    console.log(`
Next steps:
  cd ${projectName}
  npm install
  npm run dev
`);
}
main();
