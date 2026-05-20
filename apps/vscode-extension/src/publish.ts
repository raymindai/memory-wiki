import * as vscode from "vscode";
import { getApiBaseUrl } from "./extension";
import { AuthManager } from "./auth";

interface PublishResult {
  id: string;
  editToken: string;
  created_at?: string;
}

interface PullResult {
  markdown: string;
  title: string | null;
  updated_at: string;
  editToken?: string;
  isOwner?: boolean;
  user_id?: string;
}

/**
 * Publish a new document to Memory.Wiki.
 * POST /api/docs → { id, editToken }
 */
export async function publishDocument(
  markdown: string,
  title: string,
  authManager?: AuthManager
): Promise<PublishResult> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/docs`;

  const body: Record<string, unknown> = { markdown, title, isDraft: false, source: "vscode" };

  // Attach userId if logged in
  const userId = await authManager?.getUserId();
  if (userId) {
    body.userId = userId;
  }

  const token = await authManager?.getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const email = await authManager?.getEmail();
  if (email) {
    headers["x-user-email"] = email;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error ||
        `HTTP ${response.status}: ${response.statusText}`
    );
  }

  const data = (await response.json()) as PublishResult;
  return data;
}

/**
 * Update an existing document on Memory.Wiki.
 * PATCH /api/docs/{id} → { ok: true, updated_at }
 */
export async function updateDocument(
  id: string,
  editToken: string,
  markdown: string,
  title: string,
  authManager?: AuthManager,
  expectedUpdatedAt?: string
): Promise<{ updated_at: string }> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/docs/${id}`;

  const body: Record<string, unknown> = {
    editToken,
    markdown,
    title,
    action: "auto-save",
  };
  if (expectedUpdatedAt) {
    body.expectedUpdatedAt = expectedUpdatedAt;
  }

  const userId = await authManager?.getUserId();
  if (userId) {
    body.userId = userId;
  }

  const email = await authManager?.getEmail();
  if (email) {
    body.userEmail = email;
  }

  const token = await authManager?.getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (email) {
    headers["x-user-email"] = email;
  }

  const response = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });

  if (response.status === 409) {
    const conflictData = await response.json().catch(() => ({})) as {
      conflict?: boolean;
      serverMarkdown?: string;
      serverUpdatedAt?: string;
    };
    const err = new Error("Conflict: document was modified by someone else");
    (err as ConflictError).conflict = true;
    (err as ConflictError).serverMarkdown = conflictData.serverMarkdown || "";
    (err as ConflictError).serverUpdatedAt = conflictData.serverUpdatedAt || "";
    throw err;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error ||
        `HTTP ${response.status}: ${response.statusText}`
    );
  }

  const data = await response.json() as { ok: boolean; updated_at?: string };
  return { updated_at: data.updated_at || new Date().toISOString() };
}

export interface ConflictError extends Error {
  conflict: boolean;
  serverMarkdown: string;
  serverUpdatedAt: string;
}

/**
 * Pull the latest document content from Memory.Wiki.
 * GET /api/docs/{id} → { markdown, title, updated_at, ... }
 */
export async function pullDocument(
  id: string,
  authManager?: AuthManager
): Promise<PullResult> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/docs/${id}`;

  const headers: Record<string, string> = {};
  const token = await authManager?.getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const userId = await authManager?.getUserId();
  if (userId) {
    headers["x-user-id"] = userId;
  }
  const email = await authManager?.getEmail();
  if (email) {
    headers["x-user-email"] = email;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: string }).error ||
        `HTTP ${response.status}: ${response.statusText}`
    );
  }

  const data = (await response.json()) as PullResult;
  return data;
}

/**
 * Check if the server document has been updated since last sync.
 * Returns status with updated_at timestamp, or "deleted"/"error".
 */
export async function checkServerUpdatedAt(
  id: string,
  authManager?: AuthManager
): Promise<{ status: "ok"; updated_at: string } | { status: "deleted" } | { status: "error" }> {
  const baseUrl = getApiBaseUrl();
  const headers: Record<string, string> = {};
  const token = await authManager?.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const response = await fetch(`${baseUrl}/api/docs/${id}`, {
      method: "HEAD",
      headers,
    });
    if (response.status === 404 || response.status === 410) {
      return { status: "deleted" };
    }
    if (!response.ok) return { status: "error" };
    const updatedAt = response.headers.get("x-updated-at");
    return updatedAt ? { status: "ok", updated_at: updatedAt } : { status: "error" };
  } catch {
    return { status: "error" };
  }
}
