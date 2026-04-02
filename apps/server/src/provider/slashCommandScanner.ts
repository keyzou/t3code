/**
 * Slash command discovery — filesystem scanning and frontmatter parsing
 * for provider-specific slash commands (skills and commands).
 *
 * @module slashCommandScanner
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { SlashCommandScope } from "@t3tools/contracts";

const MAX_DESCRIPTION_LENGTH = 250;

export interface SkillFrontmatter {
  readonly name: string | null;
  readonly description: string | null;
  readonly userInvocable: boolean;
}

/**
 * Parse YAML frontmatter from a SKILL.md or command .md file.
 * Extracts name, description, and user-invocable fields.
 * Falls back to the first paragraph of the body when no description is in the frontmatter.
 */
export function parseSkillFrontmatter(content: string): SkillFrontmatter {
  const frontmatterMatch = /^---\n([\s\S]*?)\n---/.exec(content);

  if (!frontmatterMatch) {
    return { name: null, description: null, userInvocable: true };
  }

  const frontmatterBlock = frontmatterMatch[1] ?? "";
  const body = content.slice(frontmatterMatch[0].length);

  const name = extractField(frontmatterBlock, "name");
  let description = extractField(frontmatterBlock, "description");
  const userInvocableRaw = extractField(frontmatterBlock, "user-invocable");
  const userInvocable = userInvocableRaw !== "false";

  if (description === null) {
    description = extractFirstParagraph(body);
  }

  if (description !== null && description.length > MAX_DESCRIPTION_LENGTH) {
    description = description.slice(0, MAX_DESCRIPTION_LENGTH);
  }

  return { name, description, userInvocable };
}

function extractField(frontmatter: string, key: string): string | null {
  const prefix = `${key}:`;
  for (const line of frontmatter.split("\n")) {
    if (line.startsWith(prefix)) {
      return line.slice(prefix.length).trim();
    }
  }
  return null;
}

function extractFirstParagraph(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.length === 0) return null;

  const paragraphEnd = trimmed.indexOf("\n\n");
  const paragraph = paragraphEnd === -1 ? trimmed : trimmed.slice(0, paragraphEnd);
  const cleaned = paragraph.trim();
  return cleaned.length > 0 ? cleaned : null;
}

// ---------------------------------------------------------------------------
// Slash command entry
// ---------------------------------------------------------------------------

export interface SlashCommandEntry {
  readonly name: string;
  readonly description: string | null;
  readonly scope: SlashCommandScope;
}

// ---------------------------------------------------------------------------
// Built-in skills by provider
// ---------------------------------------------------------------------------

export const CODEX_BUILT_IN_SKILLS: readonly SlashCommandEntry[] = [
  { name: "skill-creator", description: "Author new skills", scope: "builtin" },
  { name: "skill-installer", description: "Download curated skills", scope: "builtin" },
];

export const CLAUDE_BUILT_IN_SKILLS: readonly SlashCommandEntry[] = [
  {
    name: "batch",
    description: "Orchestrate large-scale changes across a codebase in parallel",
    scope: "builtin",
  },
  {
    name: "simplify",
    description: "Review changed code for reuse, quality, and efficiency",
    scope: "builtin",
  },
  { name: "debug", description: "Enable debug logging and troubleshoot issues", scope: "builtin" },
  { name: "loop", description: "Run a prompt repeatedly on an interval", scope: "builtin" },
  { name: "claude-api", description: "Load Claude API reference material", scope: "builtin" },
];

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

const SCOPE_PRECEDENCE: Record<SlashCommandScope, number> = {
  project: 0,
  user: 1,
  builtin: 2,
};

/**
 * Deduplicate entries by name. When names collide, the entry with the
 * highest-priority scope wins (project > user > built-in).
 */
function deduplicateByName(entries: readonly SlashCommandEntry[]): SlashCommandEntry[] {
  const byName = new Map<string, SlashCommandEntry>();
  for (const entry of entries) {
    const existing = byName.get(entry.name);
    if (!existing || SCOPE_PRECEDENCE[entry.scope] < SCOPE_PRECEDENCE[existing.scope]) {
      byName.set(entry.name, entry);
    }
  }
  return [...byName.values()];
}

// ---------------------------------------------------------------------------
// Filesystem scanning
// ---------------------------------------------------------------------------

/**
 * Scan Claude skill/command directories and return discovered slash commands.
 */
export async function scanClaudeSlashCommands(
  userHome: string,
  workspaceRoot: string,
): Promise<readonly SlashCommandEntry[]> {
  const results: SlashCommandEntry[] = [];

  // User-scope: ~/.claude/skills/ and ~/.claude/commands/
  const userClaudeDir = path.join(userHome, ".claude");
  results.push(...(await scanSkillsDir(path.join(userClaudeDir, "skills"), "user")));
  results.push(...(await scanCommandsDir(path.join(userClaudeDir, "commands"), "user")));

  // Project-scope: workspace root .claude/
  const projectClaudeDir = path.join(workspaceRoot, ".claude");
  results.push(...(await scanSkillsDir(path.join(projectClaudeDir, "skills"), "project")));
  results.push(...(await scanCommandsDir(path.join(projectClaudeDir, "commands"), "project")));

  // Built-in skills
  results.push(...CLAUDE_BUILT_IN_SKILLS);

  return deduplicateByName(results);
}

/**
 * Scan Codex (Agent Skills) directories and return discovered slash commands.
 */
export async function scanCodexSlashCommands(
  userHome: string,
  workspaceRoot: string,
): Promise<readonly SlashCommandEntry[]> {
  const results: SlashCommandEntry[] = [];

  // User-scope: ~/.agents/skills/
  results.push(...(await scanSkillsDir(path.join(userHome, ".agents", "skills"), "user")));

  // Project-scope: workspace root .agents/skills/
  results.push(...(await scanSkillsDir(path.join(workspaceRoot, ".agents", "skills"), "project")));

  // Built-in skills
  results.push(...CODEX_BUILT_IN_SKILLS);

  return deduplicateByName(results);
}

/**
 * Scan a skills directory (e.g. ~/.claude/skills/) for SKILL.md files.
 */
async function scanSkillsDir(dir: string, scope: "user" | "project"): Promise<SlashCommandEntry[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: SlashCommandEntry[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const skillFile = path.join(dir, entry.name, "SKILL.md");
    const content = await safeReadFile(skillFile);
    if (content === null) continue;

    const fm = parseSkillFrontmatter(content);
    if (!fm.userInvocable) continue;

    results.push({
      name: fm.name ?? entry.name,
      description: fm.description,
      scope,
    });
  }
  return results;
}

/**
 * Scan a commands directory (e.g. ~/.claude/commands/) for *.md files.
 */
async function scanCommandsDir(
  dir: string,
  scope: "user" | "project",
): Promise<SlashCommandEntry[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: SlashCommandEntry[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const content = await safeReadFile(path.join(dir, entry.name));
    if (content === null) continue;

    const fm = parseSkillFrontmatter(content);
    if (!fm.userInvocable) continue;

    const nameFromFile = entry.name.replace(/\.md$/, "");
    results.push({
      name: fm.name ?? nameFromFile,
      description: fm.description,
      scope,
    });
  }
  return results;
}

async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}
