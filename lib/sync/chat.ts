/**
 * lib/sync/chat.ts
 *
 * Read/write the AI chat transcript for a job folder. The conversation is
 * persisted as `Chat.md` so it follows the folder-as-source-of-truth pattern
 * (like the JD / resume / review files) and stays human-readable + diffable.
 *
 * Wire format — one section per turn:
 *
 *   ## User
 *   <message>
 *
 *   ## Assistant
 *   <message>
 *
 * Pure module (fs + path only) — no `server-only`, no DB — so it can be used
 * from the CLI sync context as well as Route Handlers.
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { FILES } from "./paths";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const HEADER: Record<ChatMessage["role"], string> = {
  user:      "## User",
  assistant: "## Assistant",
};

function chatPath(folderPath: string): string {
  return path.join(folderPath, FILES.chat);
}

/** Parse Chat.md into messages. Returns [] when the file is absent/unreadable. */
export function readChat(folderPath: string): ChatMessage[] {
  const file = chatPath(folderPath);
  if (!existsSync(file)) return [];
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return [];
  }

  const messages: ChatMessage[] = [];
  // Split on the section headers, keeping track of the role for each block.
  const lines = raw.split("\n");
  let role: ChatMessage["role"] | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (role && buf.length) {
      const content = buf.join("\n").trim();
      if (content) messages.push({ role, content });
    }
    buf = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === HEADER.user) {
      flush();
      role = "user";
    } else if (trimmed === HEADER.assistant) {
      flush();
      role = "assistant";
    } else if (role) {
      buf.push(line);
    }
  }
  flush();
  return messages;
}

function serialize(messages: ChatMessage[]): string {
  return messages.map((m) => `${HEADER[m.role]}\n\n${m.content.trim()}\n`).join("\n");
}

/** Append turns to Chat.md, creating the file (with a title) when needed. */
export function appendChat(folderPath: string, messages: ChatMessage[]): void {
  if (messages.length === 0) return;
  const file = chatPath(folderPath);
  const block = serialize(messages);
  if (existsSync(file)) {
    appendFileSync(file, `\n${block}`, "utf8");
  } else {
    writeFileSync(file, `# AI Chat\n\n${block}`, "utf8");
  }
}
