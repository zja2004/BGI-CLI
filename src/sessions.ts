/**
 * sessions.ts — Persistent conversation history for BGI-CLI
 *
 * Sessions are stored as JSON files in ~/.bgicli/sessions/
 * Each session file: { id, name, createdAt, updatedAt, messages, skills }
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { BGI_DIR } from './config.js';
import type { Message } from './chat.js';

export const SESSIONS_DIR = join(BGI_DIR, 'sessions');
export const CHECKPOINTS_DIR = join(BGI_DIR, 'checkpoints');

export interface SessionMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  skills: string[];
  preview: string; // first user message, truncated
}

export interface Session extends SessionMeta {
  messages: Message[];
}

function ensureSessionDirs(): void {
  for (const d of [SESSIONS_DIR, CHECKPOINTS_DIR]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }
}

function sessionPath(id: string): string {
  return join(SESSIONS_DIR, `${id}.json`);
}

/** Generate a session ID: date-based + random suffix */
export function newSessionId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6);
  return `${date}-${rand}`;
}

/** Save current session to disk. Called automatically after each AI reply. */
export function saveSession(
  id: string,
  name: string,
  messages: Message[],
  skills: string[],
  createdAt: string,
): void {
  ensureSessionDirs();
  const now = new Date().toISOString();
  // Extract preview from first user message
  const firstUser = messages.find((m) => m.role === 'user');
  const rawPreview = typeof firstUser?.content === 'string' ? firstUser.content : '';
  const preview = rawPreview.replace(/\[Skill 已加载[^\]]*\][\s\S]*/, '').trim().slice(0, 80);

  const session: Session = {
    id,
    name,
    createdAt,
    updatedAt: now,
    messageCount: messages.length,
    skills,
    preview,
    messages,
  };
  writeFileSync(sessionPath(id), JSON.stringify(session, null, 2), 'utf8');
}

/** Load a session by ID. Returns null if not found. */
export function loadSession(id: string): Session | null {
  ensureSessionDirs();
  const p = sessionPath(id);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as Session;
  } catch {
    return null;
  }
}

/** List all sessions, sorted by updatedAt descending (newest first). */
export function listSessions(): SessionMeta[] {
  ensureSessionDirs();
  const files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));
  const metas: SessionMeta[] = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(readFileSync(join(SESSIONS_DIR, f), 'utf8')) as Session;
      metas.push({
        id: raw.id,
        name: raw.name,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        messageCount: raw.messageCount,
        skills: raw.skills ?? [],
        preview: raw.preview ?? '',
      });
    } catch { /* skip corrupt files */ }
  }
  return metas.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Delete a session by ID. */
export function deleteSession(id: string): boolean {
  const p = sessionPath(id);
  if (!existsSync(p)) return false;
  unlinkSync(p);
  return true;
}

/** Get the most recently updated session. */
export function getLastSession(): SessionMeta | null {
  const all = listSessions();
  return all[0] ?? null;
}

// ── Checkpoints ───────────────────────────────────────────────────────────────

export interface Checkpoint {
  id: string;
  sessionId: string;
  label: string;       // user-visible label, e.g. "DESeq2 完成"
  createdAt: string;
  messageCount: number;
  messages: Message[];
  skills: string[];
}

function checkpointPath(id: string): string {
  return join(CHECKPOINTS_DIR, `${id}.json`);
}

/** Save a checkpoint. Returns the checkpoint ID. */
export function saveCheckpoint(
  sessionId: string,
  label: string,
  messages: Message[],
  skills: string[],
): string {
  ensureSessionDirs();
  const id = `${sessionId}-cp${Date.now()}`;
  const cp: Checkpoint = {
    id,
    sessionId,
    label,
    createdAt: new Date().toISOString(),
    messageCount: messages.length,
    messages,
    skills,
  };
  writeFileSync(checkpointPath(id), JSON.stringify(cp, null, 2), 'utf8');
  return id;
}

/** List checkpoints for a session, newest first. */
export function listCheckpoints(sessionId?: string): Checkpoint[] {
  ensureSessionDirs();
  const files = readdirSync(CHECKPOINTS_DIR).filter((f) => f.endsWith('.json'));
  const cps: Checkpoint[] = [];
  for (const f of files) {
    try {
      const cp = JSON.parse(readFileSync(join(CHECKPOINTS_DIR, f), 'utf8')) as Checkpoint;
      if (!sessionId || cp.sessionId === sessionId) cps.push(cp);
    } catch { /* skip */ }
  }
  return cps.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Load a checkpoint by ID. */
export function loadCheckpoint(id: string): Checkpoint | null {
  const p = checkpointPath(id);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as Checkpoint;
  } catch {
    return null;
  }
}

/** Delete a checkpoint. */
export function deleteCheckpoint(id: string): boolean {
  const p = checkpointPath(id);
  if (!existsSync(p)) return false;
  unlinkSync(p);
  return true;
}

/** Clear all checkpoints for a session. */
export function clearCheckpoints(sessionId: string): number {
  const cps = listCheckpoints(sessionId);
  let count = 0;
  for (const cp of cps) {
    if (deleteCheckpoint(cp.id)) count++;
  }
  return count;
}
