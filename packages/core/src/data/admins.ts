/**
 * Platform-admin roster + audit trail — server-side only (service role).
 *
 * platform_admins (0003) and admin_audit_log (0007) both have RLS ON with ZERO
 * policies: only this service-role layer can touch them. The roster is checked
 * by apps/web/lib/admin.ts requireAdmin() on EVERY admin page and action.
 */
import { createServiceClient } from './client';
import type { PlatformAdminRow } from './rows';

const ADMIN_COLS = 'auth_user_id, role, note';

/** The roster row for an auth user, or null (null = not an admin, full stop). */
export async function getPlatformAdmin(authUserId: string): Promise<PlatformAdminRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('platform_admins')
    .select(ADMIN_COLS)
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return data as PlatformAdminRow | null;
}

/**
 * Append one admin_audit_log row (0007). Best-effort by design: an audit-write
 * hiccup must never abort the admin mutation it describes — it logs loudly
 * instead. Call AFTER the mutation succeeds, with before/after snapshots.
 */
export async function logAdminAction(entry: {
  actorAuthUserId: string | null;
  action: string; // e.g. 'video.update', 'admin.mfa_enrolled'
  entity?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  const db = createServiceClient();
  const { error } = await db.from('admin_audit_log').insert({
    actor_auth_user_id: entry.actorAuthUserId,
    action: entry.action,
    entity: entry.entity ?? null,
    entity_id: entry.entityId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
  if (error) {
    console.error(`admin_audit_log: could not record '${entry.action}' by ${entry.actorAuthUserId}: ${error.message}`);
  }
}

/** Recent audit entries for the admin dashboard (service-role read). */
export async function getRecentAuditEntries(limit = 15): Promise<
  Array<{ id: string; actor_auth_user_id: string | null; action: string; entity: string | null; entity_id: string | null; created_at: string }>
> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('admin_audit_log')
    .select('id, actor_auth_user_id, action, entity, entity_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string; actor_auth_user_id: string | null; action: string; entity: string | null; entity_id: string | null; created_at: string;
  }>;
}
