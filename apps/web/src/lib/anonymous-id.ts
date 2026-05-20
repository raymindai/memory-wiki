/**
 * Anonymous identity for non-logged-in users.
 * Generates a UUID stored in localStorage.
 * On sign-up, documents with this ID migrate to the user account.
 */

const STORAGE_KEY = "mw-anon-id";

/**
 * Returns the anonymous ID if one exists, or creates one.
 * Returns empty string if already cleared (user migrated to account).
 */
export function getAnonymousId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) || "";
}

/**
 * Ensures an anonymous ID exists. Creates one if needed.
 * Call this only when you need to create documents without login.
 */
export function ensureAnonymousId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function clearAnonymousId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
