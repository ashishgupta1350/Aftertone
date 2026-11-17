import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function normalizeId(value) {
  const id = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (/^\+?[\d() .-]+$/.test(id)) {
    const digits = id.replace(/\D/g, "");
    const number = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
    if (/^\d{8,15}$/.test(number)) return number;
  }
  if (/^[\w.!#$%&'*+\/=?^\x60{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(id) && id.length <= 200) return id;
  if (/^[a-z0-9][a-z0-9_.-]{2,39}$/.test(id)) return id;
  throw new ApiError(400, "Enter an email, phone number, or username with at least 3 characters.");
}

import { createHash } from "node:crypto";
function alias(id) {
  if (id.includes("@")) return id;
  const hash = createHash("sha256").update("aftertone:" + id).digest("hex").slice(0, 32);
  return "aftertone-" + hash + "@accounts.aftertone.invalid";
}

export function createFirebase(env = process.env) {
  const { FIREBASE_PROJECT_ID: projectId, FIREBASE_DATABASE_URL: databaseURL, FIREBASE_API_KEY: apiKey,
    FIREBASE_AUTH_EMULATOR_HOST: authEmulator, FIREBASE_DATABASE_EMULATOR_HOST: dbEmulator } = env;
  if (!(projectId && databaseURL && apiKey) || Boolean(authEmulator) !== Boolean(dbEmulator)) {
    throw new Error("Set FIREBASE_PROJECT_ID, FIREBASE_DATABASE_URL, and FIREBASE_API_KEY. Local tests use both Firebase emulators.");
  }
  const service = env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) : null;
  const app = initializeApp({
    projectId, databaseURL,
    ...(!authEmulator && { credential: service ? cert(service) : applicationDefault() }),
  });
  const auth = getAuth(app);
  const db = getDatabase(app);
  const identity = authEmulator ? "http://" + authEmulator + "/identitytoolkit.googleapis.com" : "https://identitytoolkit.googleapis.com";
  const secureToken = authEmulator ? "http://" + authEmulator + "/securetoken.googleapis.com" : "https://securetoken.googleapis.com";
  const adminUid = env.AFTERTONE_ADMIN_UID;

  async function exchange(url, body) {
    url.searchParams.set("key", apiKey);
    const form = body instanceof URLSearchParams;
    const response = await fetch(url, {
      method: "POST", body: form ? body : JSON.stringify(body),
      ...(form ? {} : { headers: { "Content-Type": "application/json" } }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    if (!response.ok) {
      const code = result.error?.message?.split(" : ")[0];
      if (code === "EMAIL_EXISTS") throw new ApiError(409, "That ID already has an account. Sign in instead.");
      if (code === "USER_DISABLED") throw new ApiError(403, "This account has been disabled.");
      if (["TOO_MANY_ATTEMPTS_TRY_LATER", "QUOTA_EXCEEDED"].includes(code)) throw new ApiError(429, "Too many attempts. Try again later.");
      if (code === "WEAK_PASSWORD") throw new ApiError(400, "Choose a longer password.");
      if (response.status < 500) throw new ApiError(401, "The ID or password is incorrect, or your session expired.");
      throw new ApiError(502, "Account service is unavailable.");
    }
    return { token: result.idToken ?? result.id_token, refresh: result.refreshToken ?? result.refresh_token,
      uid: result.localId ?? result.user_id, id: result.displayName || result.email };
  }

  async function account(body, signup) {
    const id = normalizeId(body.id);
    const password = body.password;
    if (typeof password !== "string" || password.length > 128 || password.length < (signup ? 8 : 1)) {
      throw new ApiError(400, signup ? "Use a password with at least 8 characters." : "Enter your password.");
    }
    if (id.endsWith("@accounts.aftertone.invalid")) throw new ApiError(400, "Use the ID you signed up with.");
    const endpoint = signup ? "signUp" : "signInWithPassword";
    const session = await exchange(new URL(identity + "/v1/accounts:" + endpoint), {
      email: alias(id), password, returnSecureToken: true, ...(signup && { displayName: id }),
    });
    return { ...session, id };
  }

  async function verify(token) {
    if (!token) throw new ApiError(401, "Sign in to Aftertone.");
    try { return await auth.verifyIdToken(token, true); }
    catch (error) {
      if (error.code === "auth/user-disabled") throw new ApiError(403, "This account has been disabled.");
      if (["auth/user-not-found", "auth/id-token-expired", "auth/id-token-revoked", "auth/invalid-id-token", "auth/argument-error"].includes(error.code)) {
        throw new ApiError(401, "Sign in to Aftertone.");
      }
      throw error;
    }
  }

  function requireAdmin(uid) {
    if (!adminUid || uid !== adminUid) throw new ApiError(403, "Administrator access required.");
  }

  return {
    account, verify, isAdmin: (uid) => Boolean(adminUid && uid === adminUid),
    refresh: (refresh) => exchange(new URL(secureToken + "/v1/token"), new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh })),
    library: (uid) => db.ref("aftertoneLibraries").child(uid),
    async users(uid, page) {
      requireAdmin(uid);
      const result = await auth.listUsers(100, page || undefined);
      return { next: result.pageToken, users: result.users.map((user) => ({
        uid: user.uid, id: user.displayName || (user.email?.endsWith("@accounts.aftertone.invalid") ? "Existing Aftertone account" : user.email),
        created: user.metadata.creationTime, lastSignIn: user.metadata.lastSignInTime, disabled: user.disabled, admin: user.uid === adminUid,
      })) };
    },
    async setDisabled(uid, target, disabled) {
      requireAdmin(uid);
      if (target === uid) throw new ApiError(400, "The administrator cannot disable their own account.");
      await auth.updateUser(target, { disabled });
      if (disabled) await auth.revokeRefreshTokens(target);
    },
  };
}
