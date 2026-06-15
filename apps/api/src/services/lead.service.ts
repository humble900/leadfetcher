import { eq, and, desc, sql, ilike, or, gte } from 'drizzle-orm';
import { getDb } from '../config/database.js';
import { leads, jobs } from '../db/schema.js';
import { logger } from '../utils/logger.js';
import type { LeadQuery } from '@leadfetcher/shared';

export class LeadService {
  /**
   * Get leads with filtering, searching, and pagination — ALWAYS tenant scoped
   */
  async getLeads(tenantId: string, query: LeadQuery) {
    const db = getDb();
    const { page = 1, limit = 20, jobId, search, hasEmail, hasPhone, isVerified, minQualityScore, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions: any[] = [eq(leads.tenantId, tenantId)];

    if (jobId) conditions.push(eq(leads.jobId, jobId));
    if (hasEmail === true) conditions.push(sql`${leads.email} IS NOT NULL AND ${leads.email} != ''`);
    if (hasPhone === true) conditions.push(sql`${leads.phone} IS NOT NULL AND ${leads.phone} != ''`);
    if (isVerified !== undefined) conditions.push(eq(leads.isVerified, isVerified));
    if (minQualityScore !== undefined) conditions.push(gte(leads.qualityScore, minQualityScore));
    if (search) {
      conditions.push(or(
        ilike(leads.vendorName, `%${search}%`),
        ilike(leads.email, `%${search}%`),
        ilike(leads.phone, `%${search}%`),
        ilike(leads.location, `%${search}%`),
      ));
    }

    const where = and(...conditions);

    // Count total
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(where);

    const total = countResult?.count || 0;

    // Get paginated results
    const orderColumn = sortBy === 'qualityScore' ? leads.qualityScore
      : sortBy === 'vendorName' ? leads.vendorName
        : leads.createdAt;

    const rows = await db.select()
      .from(leads)
      .where(where)
      .orderBy(sortOrder === 'asc' ? orderColumn : desc(orderColumn))
      .limit(limit)
      .offset(offset);

    return {
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single lead — tenant scoped
   */
  async getLeadById(tenantId: string, leadId: string) {
    const db = getDb();

    const [lead] = await db.select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .limit(1);

    if (!lead) {
      throw Object.assign(new Error('Lead not found'), { statusCode: 404 });
    }

    return lead;
  }

  /**
   * Get lead statistics for a tenant
   */
  async getStats(tenantId: string) {
    const db = getDb();

    const [stats] = await db.select({
      total: sql<number>`count(*)::int`,
      withEmail: sql<number>`count(case when email is not null and email != '' then 1 end)::int`,
      withPhone: sql<number>`count(case when phone is not null and phone != '' then 1 end)::int`,
      verified: sql<number>`count(case when is_verified = true then 1 end)::int`,
      avgQuality: sql<number>`coalesce(round(avg(quality_score))::int, 0)`,
    }).from(leads).where(eq(leads.tenantId, tenantId));

    return stats;
  }

  /**
   * Export leads as CSV data — tenant scoped
   */
  async exportLeads(tenantId: string, jobId?: string) {
    const db = getDb();

    const conditions: any[] = [eq(leads.tenantId, tenantId)];
    if (jobId) conditions.push(eq(leads.jobId, jobId));

    const rows = await db.select()
      .from(leads)
      .where(and(...conditions))
      .orderBy(desc(leads.createdAt));

    return rows;
  }

  /**
   * Delete a lead — tenant scoped
   */
  async deleteLead(tenantId: string, leadId: string) {
    const db = getDb();

    const [deleted] = await db.delete(leads)
      .where(and(eq(leads.id, leadId), eq(leads.tenantId, tenantId)))
      .returning();

    if (!deleted) {
      throw Object.assign(new Error('Lead not found'), { statusCode: 404 });
    }

    return deleted;
  }
}

export const leadService = new LeadService();