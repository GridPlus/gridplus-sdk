import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Session data stored in ~/.gridplus/session.json
 */
export interface SessionData {
  deviceId: string;
  baseUrl: string;
  name: string;
  appSecret: string;
  clientData?: string;
}

const SESSION_DIR = join(homedir(), '.gridplus');
const SESSION_FILE = join(SESSION_DIR, 'session.json');

/**
 * Ensures the ~/.gridplus directory exists
 */
function ensureSessionDirectory(): void {
  if (!existsSync(SESSION_DIR)) {
    mkdirSync(SESSION_DIR, { recursive: true });
  }
}

/**
 * Loads session data from disk
 */
export function loadSession(): SessionData | null {
  try {
    if (!existsSync(SESSION_FILE)) {
      return null;
    }
    const data = readFileSync(SESSION_FILE, 'utf-8');
    return JSON.parse(data) as SessionData;
  } catch {
    return null;
  }
}

/**
 * Saves session data to disk
 */
export function saveSession(session: SessionData): void {
  ensureSessionDirectory();
  writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

/**
 * Clears session data from disk
 */
export function clearSession(): void {
  if (existsSync(SESSION_FILE)) {
    writeFileSync(SESSION_FILE, '{}');
  }
}

/**
 * Checks if a session exists
 */
export function hasSession(): boolean {
  const session = loadSession();
  return session !== null && Boolean(session.deviceId);
}

/**
 * Gets the stored client data callback for SDK setup
 * This is used with the SDK's getStoredClient callback pattern
 */
export function getStoredClient(): Promise<string> {
  const session = loadSession();
  return Promise.resolve(session?.clientData ?? '');
}

/**
 * Sets the stored client data callback for SDK setup
 * This is used with the SDK's setStoredClient callback pattern
 */
export function setStoredClient(clientData: string | null): Promise<void> {
  const session = loadSession();
  if (session && clientData) {
    session.clientData = clientData;
    saveSession(session);
  }
  return Promise.resolve();
}

/**
 * Updates the client data in the current session
 */
export function updateSessionClientData(clientData: string): void {
  const session = loadSession();
  if (session) {
    session.clientData = clientData;
    saveSession(session);
  }
}

/**
 * Gets the session directory path
 */
export function getSessionDirectory(): string {
  return SESSION_DIR;
}

/**
 * Gets the session file path
 */
export function getSessionFilePath(): string {
  return SESSION_FILE;
}
