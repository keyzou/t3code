import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CLAUDE_BUILT_IN_SKILLS,
  CODEX_BUILT_IN_SKILLS,
  parseSkillFrontmatter,
  scanClaudeSlashCommands,
  scanCodexSlashCommands,
} from "./slashCommandScanner.ts";

describe("parseSkillFrontmatter", () => {
  it("extracts name and description from frontmatter", () => {
    const content = [
      "---",
      "name: grill-me",
      "description: Interview the user relentlessly about a plan",
      "---",
      "",
      "Interview me relentlessly about every aspect...",
    ].join("\n");

    const result = parseSkillFrontmatter(content);
    expect(result).toEqual({
      name: "grill-me",
      description: "Interview the user relentlessly about a plan",
      userInvocable: true,
    });
  });

  it("returns userInvocable false when set in frontmatter", () => {
    const content = [
      "---",
      "name: background-context",
      "description: Background knowledge",
      "user-invocable: false",
      "---",
      "",
      "Some background context...",
    ].join("\n");

    const result = parseSkillFrontmatter(content);
    expect(result).toEqual({
      name: "background-context",
      description: "Background knowledge",
      userInvocable: false,
    });
  });

  it("returns null name when frontmatter has no name field", () => {
    const content = ["---", "description: Some description", "---", "", "Content here..."].join(
      "\n",
    );

    const result = parseSkillFrontmatter(content);
    expect(result.name).toBeNull();
    expect(result.description).toBe("Some description");
  });

  it("returns null for both when no frontmatter present", () => {
    const content = "Just some markdown without frontmatter.";

    const result = parseSkillFrontmatter(content);
    expect(result).toEqual({
      name: null,
      description: null,
      userInvocable: true,
    });
  });

  it("falls back to first paragraph when no description in frontmatter", () => {
    const content = [
      "---",
      "name: my-skill",
      "---",
      "",
      "This is the first paragraph of the skill content.",
      "",
      "This is the second paragraph.",
    ].join("\n");

    const result = parseSkillFrontmatter(content);
    expect(result.name).toBe("my-skill");
    expect(result.description).toBe("This is the first paragraph of the skill content.");
  });

  it("truncates long descriptions to 250 characters", () => {
    const longDesc = "A".repeat(300);
    const content = [`---`, `name: verbose`, `description: ${longDesc}`, `---`, ""].join("\n");

    const result = parseSkillFrontmatter(content);
    expect(result.description).toHaveLength(250);
  });
});

describe("scanClaudeSlashCommands", () => {
  let tmpDir: string;
  let userHome: string;
  let workspaceRoot: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "slash-cmd-test-"));
    userHome = path.join(tmpDir, "home");
    workspaceRoot = path.join(tmpDir, "workspace");
    mkdirSync(userHome, { recursive: true });
    mkdirSync(workspaceRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("discovers user-scope skills from ~/.claude/skills/", async () => {
    const skillDir = path.join(userHome, ".claude", "skills", "my-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      path.join(skillDir, "SKILL.md"),
      ["---", "name: my-skill", "description: A test skill", "---", ""].join("\n"),
    );

    const results = await scanClaudeSlashCommands(userHome, workspaceRoot);
    const skill = results.find((r) => r.name === "my-skill");
    expect(skill).toBeDefined();
    expect(skill!.scope).toBe("user");
    expect(skill!.description).toBe("A test skill");
  });

  it("discovers project-scope skills from workspace .claude/skills/", async () => {
    const skillDir = path.join(workspaceRoot, ".claude", "skills", "proj-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      path.join(skillDir, "SKILL.md"),
      ["---", "name: proj-skill", "description: A project skill", "---", ""].join("\n"),
    );

    const results = await scanClaudeSlashCommands(userHome, workspaceRoot);
    const skill = results.find((r) => r.name === "proj-skill");
    expect(skill).toBeDefined();
    expect(skill!.scope).toBe("project");
  });

  it("discovers user-scope commands from ~/.claude/commands/", async () => {
    const cmdDir = path.join(userHome, ".claude", "commands");
    mkdirSync(cmdDir, { recursive: true });
    writeFileSync(
      path.join(cmdDir, "deploy.md"),
      ["---", "description: Deploy to production", "---", ""].join("\n"),
    );

    const results = await scanClaudeSlashCommands(userHome, workspaceRoot);
    const cmd = results.find((r) => r.name === "deploy");
    expect(cmd).toBeDefined();
    expect(cmd!.scope).toBe("user");
    expect(cmd!.description).toBe("Deploy to production");
  });

  it("uses directory name when skill has no name in frontmatter", async () => {
    const skillDir = path.join(userHome, ".claude", "skills", "inferred-name");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      path.join(skillDir, "SKILL.md"),
      ["---", "description: Name from dirname", "---", ""].join("\n"),
    );

    const results = await scanClaudeSlashCommands(userHome, workspaceRoot);
    const skill = results.find((r) => r.name === "inferred-name");
    expect(skill).toBeDefined();
  });

  it("excludes skills with user-invocable: false", async () => {
    const skillDir = path.join(userHome, ".claude", "skills", "hidden");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      path.join(skillDir, "SKILL.md"),
      ["---", "name: hidden", "user-invocable: false", "---", ""].join("\n"),
    );

    const results = await scanClaudeSlashCommands(userHome, workspaceRoot);
    expect(results.find((r) => r.name === "hidden")).toBeUndefined();
  });

  it("includes built-in Claude skills with scope built-in", async () => {
    const results = await scanClaudeSlashCommands(userHome, workspaceRoot);
    const builtIns = results.filter((r) => r.scope === "builtin");
    expect(builtIns.length).toBe(CLAUDE_BUILT_IN_SKILLS.length);
    expect(builtIns.map((b) => b.name)).toContain("batch");
    expect(builtIns.map((b) => b.name)).toContain("simplify");
  });

  it("returns empty filesystem results when .claude dirs don't exist", async () => {
    const results = await scanClaudeSlashCommands(userHome, workspaceRoot);
    const nonBuiltIn = results.filter((r) => r.scope !== "builtin");
    expect(nonBuiltIn).toHaveLength(0);
  });

  it("deduplicates by name with project > user > built-in precedence", async () => {
    // Create a user skill named "simplify" that shadows the built-in
    const userSkillDir = path.join(userHome, ".claude", "skills", "simplify");
    mkdirSync(userSkillDir, { recursive: true });
    writeFileSync(
      path.join(userSkillDir, "SKILL.md"),
      ["---", "name: simplify", "description: My custom simplify", "---", ""].join("\n"),
    );

    // Create a project skill also named "simplify" that should win
    const projSkillDir = path.join(workspaceRoot, ".claude", "skills", "simplify");
    mkdirSync(projSkillDir, { recursive: true });
    writeFileSync(
      path.join(projSkillDir, "SKILL.md"),
      ["---", "name: simplify", "description: Project simplify", "---", ""].join("\n"),
    );

    const results = await scanClaudeSlashCommands(userHome, workspaceRoot);
    const simplifyEntries = results.filter((r) => r.name === "simplify");
    expect(simplifyEntries).toHaveLength(1);
    expect(simplifyEntries[0]!.scope).toBe("project");
    expect(simplifyEntries[0]!.description).toBe("Project simplify");
  });
});

describe("scanCodexSlashCommands", () => {
  let tmpDir: string;
  let userHome: string;
  let workspaceRoot: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "codex-cmd-test-"));
    userHome = path.join(tmpDir, "home");
    workspaceRoot = path.join(tmpDir, "workspace");
    mkdirSync(userHome, { recursive: true });
    mkdirSync(workspaceRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("discovers user-scope skills from ~/.agents/skills/", async () => {
    const skillDir = path.join(userHome, ".agents", "skills", "my-codex-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      path.join(skillDir, "SKILL.md"),
      ["---", "name: my-codex-skill", "description: A Codex skill", "---", ""].join("\n"),
    );

    const results = await scanCodexSlashCommands(userHome, workspaceRoot);
    const skill = results.find((r) => r.name === "my-codex-skill");
    expect(skill).toBeDefined();
    expect(skill!.scope).toBe("user");
    expect(skill!.description).toBe("A Codex skill");
  });

  it("discovers project-scope skills from workspace .agents/skills/", async () => {
    const skillDir = path.join(workspaceRoot, ".agents", "skills", "repo-skill");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      path.join(skillDir, "SKILL.md"),
      ["---", "name: repo-skill", "description: A repo skill", "---", ""].join("\n"),
    );

    const results = await scanCodexSlashCommands(userHome, workspaceRoot);
    const skill = results.find((r) => r.name === "repo-skill");
    expect(skill).toBeDefined();
    expect(skill!.scope).toBe("project");
  });

  it("includes built-in Codex skills with scope built-in", async () => {
    const results = await scanCodexSlashCommands(userHome, workspaceRoot);
    const builtIns = results.filter((r) => r.scope === "builtin");
    expect(builtIns.length).toBe(CODEX_BUILT_IN_SKILLS.length);
    expect(builtIns.map((b) => b.name)).toContain("skill-creator");
    expect(builtIns.map((b) => b.name)).toContain("skill-installer");
  });

  it("returns empty filesystem results when .agents dirs don't exist", async () => {
    const results = await scanCodexSlashCommands(userHome, workspaceRoot);
    const nonBuiltIn = results.filter((r) => r.scope !== "builtin");
    expect(nonBuiltIn).toHaveLength(0);
  });
});
