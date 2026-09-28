/** SQL for the opt-in identity extensions (`auth_0007_identity_extensions.sql`). */
import { nowIso, newId, sha256 } from "@softwareseva/core/server";

export type BoundOtp = { id: string; code_hash: string; attempts: number; expires_at: string };

export class ExtensionStore {
  constructor(readonly db: D1Database) {}

  // ----- purpose-bound OTP -----
  async createOtp(channel: string, purpose: string, destination: string, userId: string, hash: string, expires: string) {
    await this.db.batch([
      this.db.prepare("UPDATE auth_bound_otp SET consumed_at=? WHERE channel=? AND purpose=? AND destination=? AND user_id=? AND consumed_at IS NULL").bind(nowIso(), channel, purpose, destination, userId),
      this.db.prepare("INSERT INTO auth_bound_otp(id,channel,purpose,destination,user_id,code_hash,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(newId("otp"), channel, purpose, destination, userId, hash, expires, nowIso()),
    ]);
  }
  /**
   * Atomically claims one verification attempt against the latest unconsumed, unexpired code for
   * this (channel, purpose, destination, user): increments `attempts` and returns the hash to
   * compare against, but only when `attempts < maxAttempts`. A single UPDATE (the row is picked by
   * the subquery, then the WHERE guard applies to that same row) so concurrent guesses can't all
   * read "attempts still under the limit" and all slip through before any of them lands its
   * increment.
   */
  async claimOtpAttempt(channel: string, purpose: string, destination: string, userId: string, maxAttempts: number): Promise<Pick<BoundOtp, "id" | "code_hash"> | null> {
    return (
      await this.db
        .prepare(
          `UPDATE auth_bound_otp SET attempts=attempts+1
           WHERE id=(SELECT id FROM auth_bound_otp WHERE channel=? AND purpose=? AND destination=? AND user_id=? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1)
             AND attempts<? AND expires_at>?
           RETURNING id,code_hash`,
        )
        .bind(channel, purpose, destination, userId, maxAttempts, nowIso())
        .first<Pick<BoundOtp, "id" | "code_hash">>()
    ) ?? null;
  }
  /** Consumes exactly once; returns false when already consumed (e.g. raced by a concurrent verify), so callers must reject the request rather than complete it twice. */
  async consumeOtp(id: string) {
    return (await this.db.prepare("UPDATE auth_bound_otp SET consumed_at=? WHERE id=? AND consumed_at IS NULL").bind(nowIso(), id).run()).meta.changes === 1;
  }

  // ----- contact aliases (populated by attachContact / linkGoogle / recordAlias so contactOwner sees them) -----
  private aliasWrite(channel: string, destination: string, userId: string) {
    return this.db.prepare("INSERT INTO auth_contact_aliases(channel,destination,user_id) VALUES(?,?,?) ON CONFLICT(channel,destination) DO UPDATE SET user_id=excluded.user_id").bind(channel, destination, userId);
  }
  /** Record that `destination` belongs to `userId`, so a later `contactOwner` lookup (e.g. from another sign-in path) sees the association. */
  async recordAlias(channel: "email" | "phone", destination: string, userId: string) {
    await this.aliasWrite(channel, destination, userId).run();
  }
  async attachContact(userId: string, channel: "email" | "phone", destination: string) {
    await this.db.batch([
      this.db.prepare(`UPDATE auth_users SET ${channel}=?, ${channel}_verified_at=?, updated_at=? WHERE id=? AND disabled_at IS NULL`).bind(destination, nowIso(), nowIso(), userId),
      this.aliasWrite(channel, destination, userId),
    ]);
  }
  async contactOwner(channel: string, destination: string) {
    return (await this.db.prepare("SELECT user_id FROM auth_contact_aliases WHERE channel=? AND destination=?").bind(channel, destination).first<{ user_id: string }>())?.user_id ?? null;
  }

  // ----- linked identities -----
  async identities(userId: string) {
    return (await this.db.prepare("SELECT id,provider,email,created_at FROM auth_identities WHERE user_id=?").bind(userId).all()).results;
  }
  async linkGoogle(userId: string, subject: string, email: string | null, verified: boolean) {
    const writes = [
      this.db.prepare("INSERT INTO auth_identities(id,user_id,provider,subject,email,created_at) VALUES(?,?,'google',?,?,?)").bind(newId("idn"), userId, subject, email, nowIso()),
      this.db.prepare("UPDATE auth_users SET email=COALESCE(email,?),email_verified_at=CASE WHEN email IS NULL OR email=? THEN COALESCE(email_verified_at,?) ELSE email_verified_at END,updated_at=? WHERE id=?").bind(verified ? email : null, email, verified ? nowIso() : null, nowIso(), userId),
    ];
    if (verified && email) writes.push(this.aliasWrite("email", email, userId));
    await this.db.batch(writes);
  }
  async unlinkIdentity(id: string, userId: string) {
    return (await this.db.prepare("DELETE FROM auth_identities WHERE id=? AND user_id=?").bind(id, userId).run()).meta.changes === 1;
  }

  /** Counts of every way this user can currently get back in: passkeys, unused recovery codes, non-`kashi` linked identities, plus verified contact flags. Used to block removing the last one. */
  async methods(userId: string) {
    return this.db.prepare("SELECT (SELECT COUNT(*) FROM auth_passkeys WHERE user_id=u.id) AS passkeys,(SELECT COUNT(*) FROM auth_recovery_codes WHERE user_id=u.id AND consumed_at IS NULL) AS recovery,(SELECT COUNT(*) FROM auth_identities WHERE user_id=u.id AND provider != 'kashi') AS identities,email_verified_at,phone_verified_at FROM auth_users u WHERE id=?")
      .bind(userId)
      .first<{ passkeys: number; recovery: number; identities: number; email_verified_at: string | null; phone_verified_at: string | null }>();
  }

  // ----- recovery codes -----
  async replaceRecovery(userId: string, codes: string[]) {
    await this.db.batch([
      this.db.prepare("DELETE FROM auth_recovery_codes WHERE user_id=?").bind(userId),
      ...(await Promise.all(codes.map(async (code) => this.db.prepare("INSERT INTO auth_recovery_codes(code_hash,user_id,created_at) VALUES(?,?,?)").bind(await sha256(code), userId, nowIso())))),
    ]);
  }
  async consumeRecovery(code: string) {
    const hash = await sha256(code);
    const row = await this.db.prepare("SELECT user_id FROM auth_recovery_codes WHERE code_hash=? AND consumed_at IS NULL").bind(hash).first<{ user_id: string }>();
    if (!row) return null;
    const result = await this.db.prepare("UPDATE auth_recovery_codes SET consumed_at=? WHERE code_hash=? AND consumed_at IS NULL").bind(nowIso(), hash).run();
    return result.meta.changes === 1 ? row.user_id : null;
  }
  async recoveryCount(userId: string) {
    return (await this.db.prepare("SELECT COUNT(*) AS n FROM auth_recovery_codes WHERE user_id=? AND consumed_at IS NULL").bind(userId).first<{ n: number }>())?.n ?? 0;
  }

  // ----- peer (federation consumer) session association -----
  async linkPeer(familyId: string, userId: string, subject: string, sessionId: string) {
    await this.db.prepare("INSERT INTO auth_peer_sessions(family_id,user_id,subject,central_session_id) VALUES(?,?,?,?)").bind(familyId, userId, subject, sessionId).run();
  }
  peer(familyId: string) {
    return this.db.prepare("SELECT subject,central_session_id FROM auth_peer_sessions WHERE family_id=?").bind(familyId).first<{ subject: string; central_session_id: string }>();
  }

  /** When the family behind `familyId` was first created — the basis for `requireRecent`'s freshness check. */
  async familyIssued(userId: string, familyId: string) {
    return this.db.prepare("SELECT MIN(created_at) AS created_at FROM auth_refresh_sessions WHERE user_id=? AND family_id=?").bind(userId, familyId).first<{ created_at: string | null }>();
  }
}
