import * as vscode from "vscode";
import { getApiBaseUrl } from "./extension";

const TOKEN_KEY = "memorywiki.authToken";
const USER_ID_KEY = "memorywiki.userId";

export class AuthManager {
  private context: vscode.ExtensionContext;
  private pendingAuthResolve:
    | ((token: string) => void)
    | undefined;
  private _onDidLogin = new vscode.EventEmitter<void>();
  readonly onDidLogin = this._onDidLogin.event;
  private _onDidLogout = new vscode.EventEmitter<void>();
  readonly onDidLogout = this._onDidLogout.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Initiate login flow.
   * Opens the browser to memory.wiki/auth/vscode which redirects back with a token.
   */
  async login(): Promise<void> {
    const baseUrl = getApiBaseUrl();

    // The callback URI for this extension
    const callbackUri = await vscode.env.asExternalUri(
      vscode.Uri.parse("vscode://raymindai.memory-wiki-vscode/auth")
    );

    const authUrl = `${baseUrl}/auth/vscode?redirect=${encodeURIComponent(
      callbackUri.toString()
    )}`;

    vscode.env.openExternal(vscode.Uri.parse(authUrl));

    // Use withProgress so the "Opening browser…" toast is bound to
    // the in-flight callback Promise and auto-dismisses the moment
    // the OAuth round-trip resolves (success or fail). The previous
    // plain showInformationMessage stuck around forever because info
    // messages have no auto-dismiss and the extension never disposed
    // them. Founder reported the toast staying open after a clean
    // login.
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "memory.wiki: opening browser for login",
        cancellable: false,
      },
      async () => {
        try {
          const token = await new Promise<string>((resolve, reject) => {
            this.pendingAuthResolve = resolve;
            // Timeout after 5 minutes
            setTimeout(() => {
              this.pendingAuthResolve = undefined;
              reject(new Error("Login timed out. Please try again."));
            }, 5 * 60 * 1000);
          });

          await this.storeToken(token);
          this._onDidLogin.fire();
          vscode.window.showInformationMessage("Signed in to memory.wiki.");
        } catch (err) {
          vscode.window.showErrorMessage(
            `Login failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    );
  }

  /**
   * Handle the OAuth callback URI.
   * Called from the URI handler in extension.ts.
   */
  handleAuthCallback(uri: vscode.Uri): void {
    const query = new URLSearchParams(uri.query);
    const token = query.get("token");
    const refreshToken = query.get("refresh_token");

    if (token && this.pendingAuthResolve) {
      if (refreshToken) {
        this.context.secrets.store("memorywiki.refreshToken", refreshToken);
      }
      this.pendingAuthResolve(token);
      this.pendingAuthResolve = undefined;
    } else if (token) {
      // Callback received without pending login (e.g., direct URI open)
      if (refreshToken) {
        this.context.secrets.store("memorywiki.refreshToken", refreshToken);
      }
      this.storeToken(token).then(() => {
        this._onDidLogin.fire();
        vscode.window.showInformationMessage(
          "Successfully logged in to memory.wiki."
        );
      });
    } else {
      vscode.window.showErrorMessage(
        "Login callback received but no token was provided."
      );
    }
  }

  /**
   * Get the stored auth token, or undefined if not logged in.
   * Returns undefined if the token is expired (tries refresh first).
   */
  async getToken(): Promise<string | undefined> {
    const token = await this.context.secrets.get(TOKEN_KEY);
    if (!token) {return undefined;}

    // Check if token is expired
    try {
      const payload = decodeJwtPayload(token);
      if (payload.exp && Date.now() > Number(payload.exp) * 1000) {
        // Try refresh before logging out
        const refreshToken = await this.context.secrets.get("memorywiki.refreshToken");
        if (refreshToken) {
          try {
            const response = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refresh_token: refreshToken }),
            });
            if (response.ok) {
              const data = await response.json() as { access_token?: string; refresh_token?: string };
              if (data.access_token) {
                await this.storeToken(data.access_token);
                if (data.refresh_token) {
                  await this.context.secrets.store("memorywiki.refreshToken", data.refresh_token);
                }
                return data.access_token;
              }
            }
          } catch { /* refresh failed, fall through to logout */ }
        }
        await this.logout();
        vscode.window.showWarningMessage(
          "memory.wiki: Session expired. Sign in again to continue syncing.",
          "Sign In"
        ).then(choice => {
          if (choice === "Sign In") {vscode.commands.executeCommand("memorywiki.login");}
        });
        return undefined;
      }
    } catch {
      // Invalid token format — clear it
      await this.logout();
      vscode.window.showWarningMessage(
        "memory.wiki: Session expired. Sign in again to continue syncing.",
        "Sign In"
      ).then(choice => {
        if (choice === "Sign In") {vscode.commands.executeCommand("memorywiki.login");}
      });
      return undefined;
    }

    return token;
  }

  /**
   * Get the user ID from the stored token.
   * Decodes the JWT payload (no verification, just extraction).
   */
  async getUserId(): Promise<string | undefined> {
    // First check cached user ID
    const cached = this.context.globalState.get<string>(USER_ID_KEY);
    if (cached) {return cached;}

    const token = await this.getToken();
    if (!token) {return undefined;}

    try {
      const payload = decodeJwtPayload(token);
      const userId = String(payload.sub || payload.userId || payload.user_id || "");
      if (userId) {
        await this.context.globalState.update(USER_ID_KEY, userId);
        return userId;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Get the user's email from the stored token.
   */
  async getEmail(): Promise<string | undefined> {
    const token = await this.getToken();
    if (!token) { return undefined; }
    try {
      const payload = decodeJwtPayload(token);
      const meta = payload.user_metadata as Record<string, unknown> | undefined;
      return String(payload.email || meta?.email || "");
    } catch {
      return undefined;
    }
  }

  /**
   * Check if the user is logged in.
   */
  async isLoggedIn(): Promise<boolean> {
    const token = await this.getToken();
    if (!token) {return false;}

    // Check if token is expired
    try {
      const payload = decodeJwtPayload(token);
      if (payload.exp) {
        const expiresAt = Number(payload.exp) * 1000;
        if (Date.now() > expiresAt) {
          // Token expired, clear it
          await this.logout();
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Log out: clear stored credentials.
   */
  async logout(): Promise<void> {
    await this.context.secrets.delete(TOKEN_KEY);
    await this.context.secrets.delete("memorywiki.refreshToken");
    await this.context.globalState.update(USER_ID_KEY, undefined);
    this._onDidLogout.fire();
  }

  /**
   * Store the auth token securely.
   */
  private async storeToken(token: string): Promise<void> {
    await this.context.secrets.store(TOKEN_KEY, token);

    // Cache user ID
    try {
      const payload = decodeJwtPayload(token);
      const userId = payload.sub || payload.userId || payload.user_id;
      if (userId) {
        await this.context.globalState.update(USER_ID_KEY, userId);
      }
    } catch {
      // JWT decode failed, that's fine
    }
  }
}

/**
 * Decode a JWT payload without verification.
 * Only used for extracting user info, not for security.
 */
function decodeJwtPayload(
  token: string
): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const payload = parts[1];
  // Base64url decode
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const decoded = Buffer.from(padded, "base64").toString("utf-8");

  return JSON.parse(decoded) as Record<string, unknown>;
}
