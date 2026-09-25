/** All SQL for @softwareseva/auth. Tables are created by the package migrations (auth_*). */
import { newId, nowIso, sha256 } from "@softwareseva/core/server";
import type { AuthUser } from "./types";

type UserRow = { id: string; display_name: string; email: string | null; phone: string | null; roles: string; email_verified_at: string | null; phone_verified_at: string | null; password_hash: string | null; disabled_at: string | null };
export type PasskeyRow = { id: string; user_id: string; credential_id: string; public_key: string; counter: number; transports: string | null; device_name: string; backed_up: number; created_at: string; last_used_at: string | null };

const userColumns = "id, display_name, email, phone, roles, email_verified_at, phone_verified_at, password_hash, disabled_at";
const toUser = (r: UserRow): AuthUser => ({ id: r.id, name: r.display_name, email: r.email, phone: r.phone, roles: JSON.parse(r.roles || "[]") as string[], emailVerifiedAt: r.email_verified_at, phoneVerifiedAt: r.phone_verified_at });

export class AuthStore {
  constructor(readonly db: D1Database) {}

  // ----- users -----
  async userById(id: string): Promise<AuthUser | null> {
    const row = await this.db.prepare(`SELECT ${userColumns} FROM auth_users WHERE id = ? AND disabled_at IS NULL`).bind(id).first<UserRow>();
    return row ? toUser(row) : null;
  }
  async userByEmail(email: string) { return this.rowToUser(await this.db.prepare(`SELECT ${userColumns} FROM auth_users WHERE email = ?`).bind(email).first<UserRow>()); }
  async userByPhone(phone: string) { return this.rowToUser(await this.db.prepare(`SELECT ${userColumns} FROM auth_users WHERE phone = ?`).bind(phone).first<UserRow>()); }
  async userByIdentifier(identifier: string) { return this.rowToUser(await this.db.prepare(`SELECT ${userColumns} FROM auth_users WHERE email = ? OR phone = ?`).bind(identifier, identifier).first<UserRow>()); }
  async passwordHash(userId: string): Promise<string | null> {
    return (await this.db.prepare("SELECT password_hash FROM auth_users WHERE id = ?").bind(userId).first<{ password_hash: string | null }>())?.password_hash ?? null;
  }
  private rowToUser(row: UserRow | null): { user: AuthUser; disabled: boolean } | null {
    return row ? { user: toUser(row), disabled: row.disabled_at !== null } : null;
  }

  async createUser(input: { name: string; email?: string | null; phone?: string | null; roles: string[]; emailVerified?: boolean; phoneVerified?: boolean; passwordHash?: string | null }): Promise<AuthUser> {
    const id = newId("usr"); const now = nowIso();
    await this.db.prepare("INSERT INTO auth_users(id, display_name, email, phone, roles, email_verified_at, phone_verified_at, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, input.name, input.email ?? null, input.phone ?? null, JSON.stringify(input.roles), input.emailVerified ? now : null, input.phoneVerified ? now : null, input.passwordHash ?? null, now, now).run();
    return { id, name: input.name, email: input.email ?? null, phone: input.phone ?? null, roles: input.roles, emailVerifiedAt: input.emailVerified ? now : null, phoneVerifiedAt: input.phoneVerified ? now : null };
  }
  async markVerified(userId: string, field: "email" | "phone") {
    await this.db.prepare(`UPDATE auth_users SET ${field}_verified_at = COALESCE(${field}_verified_at, ?), updated_at = ? WHERE id = ?`).bind(nowIso(), nowIso(), userId).run();
  }
  async setName(userId: string, name: string) {
    await this.db.prepare("UPDATE auth_users SET display_name = ?, updated_at = ? WHERE id = ? AND (display_name = '' OR display_name = email OR display_name = phone)").bind(name, nowIso(), userId).run();
  }
  async setPassword(userId: string, passwordHash: string) {
    await this.db.prepare("UPDATE auth_users SET password_hash = ?, updated_at = ? WHERE id = ?").bind(passwordHash, nowIso(), userId).run();
  }

  // ----- external identities (google, apple) -----
  async userByIdentity(provider: string, subject: string) {
    return this.rowToUser(await this.db.prepare(`SELECT ${userColumns} FROM auth_users u JOIN auth_identities i ON i.user_id = u.id WHERE i.provider = ? AND i.subject = ?`).bind(provider, subject).first<UserRow>());
  }
  async linkIdentity(userId: string, provider: string, subject: string, email: string | null) {
    await this.db.prepare("INSERT INTO auth_identities(id, user_id, provider, subject, email, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(provider, subject) DO NOTHING").bind(newId("idn"), userId, provider, subject, email, nowIso()).run();
  }

  // ----- refresh sessions -----
  async createRefresh(userId: string, familyId: string, rawToken: string, expiresAt: string, deviceName: string | null) {
    await this.db.prepare("INSERT INTO auth_refresh_sessions(id, user_id, family_id, token_hash, device_name, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(newId("rs"), userId, familyId, await sha256(rawToken), deviceName, expiresAt, nowIso()).run();
  }
  async findRefresh(rawToken: string) {
    return this.db.prepare("SELECT id, user_id, family_id, expires_at, rotated_at, revoked_at FROM auth_refresh_sessions WHERE token_hash = ?").bind(await sha256(rawToken)).first<{ id: string; user_id: string; family_id: string; expires_at: string; rotated_at: string | null; revoked_at: string | null }>();
  }
  async markRotated(id: string): Promise<boolean> {
    const r = await this.db.prepare("UPDATE auth_refresh_sessions SET rotated_at = ? WHERE id = ? AND rotated_at IS NULL").bind(nowIso(), id).run();
    return r.meta.changes === 1;
  }
  async revokeFamily(familyId: string) { await this.db.prepare("UPDATE auth_refresh_sessions SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL").bind(nowIso(), familyId).run(); }
  async revokeByToken(rawToken: string) { await this.db.prepare("UPDATE auth_refresh_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").bind(nowIso(), await sha256(rawToken)).run(); }
  async revokeAllForUser(userId: string) { await this.db.prepare("UPDATE auth_refresh_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").bind(nowIso(), userId).run(); }

  // ----- one-time codes -----
  async createOtp(destination: string, codeHash: string, expiresAt: string) {
    const now = nowIso();
    await this.db.batch([
      this.db.prepare("UPDATE auth_otp_codes SET consumed_at = ? WHERE destination = ? AND consumed_at IS NULL").bind(now, destination),
      this.db.prepare("INSERT INTO auth_otp_codes(id, destination, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").bind(newId("otp"), destination, codeHash, expiresAt, now),
    ]);
  }
  async latestOtp(destination: string) {
    return this.db.prepare("SELECT id, code_hash, attempts, expires_at FROM auth_otp_codes WHERE destination = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(destination).first<{ id: string; code_hash: string; attempts: number; expires_at: string }>();
  }
  async failOtp(id: string) { await this.db.prepare("UPDATE auth_otp_codes SET attempts = attempts + 1 WHERE id = ?").bind(id).run(); }
  async consumeOtp(id: string) { await this.db.prepare("UPDATE auth_otp_codes SET consumed_at = ? WHERE id = ?").bind(nowIso(), id).run(); }

  // ----- passkeys -----
  listPasskeys(userId: string) {
    return this.db.prepare("SELECT id, credential_id, transports, device_name, backed_up, created_at, last_used_at FROM auth_passkeys WHERE user_id = ? ORDER BY created_at DESC").bind(userId).all<Pick<PasskeyRow, "id" | "credential_id" | "transports" | "device_name" | "backed_up" | "created_at" | "last_used_at">>();
  }
  passkeyByCredential(credentialId: string) { return this.db.prepare("SELECT * FROM auth_passkeys WHERE credential_id = ?").bind(credentialId).first<PasskeyRow>(); }
  async addPasskey(userId: string, credentialId: string, publicKey: string, counter: number, transports: string[], deviceName: string, backedUp: boolean) {
    await this.db.prepare("INSERT INTO auth_passkeys(id, user_id, credential_id, public_key, counter, transports, device_name, backed_up, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(newId("pk"), userId, credentialId, publicKey, counter, JSON.stringify(transports), deviceName.slice(0, 80), backedUp ? 1 : 0, nowIso()).run();
  }
  async updatePasskeyCounter(id: string, counter: number) { await this.db.prepare("UPDATE auth_passkeys SET counter = ?, last_used_at = ? WHERE id = ?").bind(counter, nowIso(), id).run(); }
  async renamePasskey(id: string, userId: string, name: string) { return (await this.db.prepare("UPDATE auth_passkeys SET device_name = ? WHERE id = ? AND user_id = ?").bind(name.slice(0, 80), id, userId).run()).meta.changes === 1; }
  async removePasskey(id: string, userId: string) { return (await this.db.prepare("DELETE FROM auth_passkeys WHERE id = ? AND user_id = ?").bind(id, userId).run()).meta.changes === 1; }
  async countPasskeys(userId: string) { return (await this.db.prepare("SELECT count(*) AS n FROM auth_passkeys WHERE user_id = ?").bind(userId).first<{ n: number }>())?.n ?? 0; }

  // ----- webauthn challenges -----
  async createChallenge(userId: string | null, kind: string, challenge: string, ttlSeconds = 300) {
    const id = newId("ch");
    await this.db.prepare("INSERT INTO auth_challenges(id, user_id, kind, challenge, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, userId, kind, challenge, new Date(Date.now() + ttlSeconds * 1000).toISOString(), nowIso()).run();
    return id;
  }
  /** Consumes exactly once; returns null when missing, expired, consumed, or bound to another user. */
  async consumeChallenge(id: string, kind: string, userId: string | null): Promise<string | null> {
    const row = await this.db.prepare("SELECT challenge, user_id FROM auth_challenges WHERE id = ? AND kind = ? AND consumed_at IS NULL AND expires_at > ?").bind(id, kind, nowIso()).first<{ challenge: string; user_id: string | null }>();
    if (!row || row.user_id !== userId) return null;
    const r = await this.db.prepare("UPDATE auth_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL").bind(nowIso(), id).run();
    return r.meta.changes === 1 ? row.challenge : null;
  }

  /** Housekeeping for a cron trigger. */
  async prune() {
    const now = nowIso();
    await this.db.batch([
      this.db.prepare("DELETE FROM auth_refresh_sessions WHERE expires_at < ? OR revoked_at < ?").bind(now, new Date(Date.now() - 7 * 86_400_000).toISOString()),
      this.db.prepare("DELETE FROM auth_otp_codes WHERE expires_at < ?").bind(now),
      this.db.prepare("DELETE FROM auth_challenges WHERE expires_at < ?").bind(now),
    ]);
  }
}
