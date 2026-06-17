import { Router } from 'express';
import { leadService } from '../services/lead.service.js';
import { LeadQuerySchema } from '@leadfetcher/shared';
import { handleValidationError } from '../middleware/errorHandler.middleware.js';
import { limitMiddleware } from '../middleware/limit.middleware.js';
import { eq, and, desc, sql, ilike, or, gte } from 'drizzle-orm';
import { getDb } from '../config/database.js';
import { leads } from '../db/schema.js';

const router = Router();

// ─── GET /api/leads — List my leads ──────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const parsed = LeadQuerySchema.safeParse({
      ...req.query,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      minQualityScore: req.query.minQualityScore ? parseInt(req.query.minQualityScore as string) : undefined,
      hasEmail: req.query.hasEmail === 'true' ? true : req.query.hasEmail === 'false' ? false : undefined,
      hasPhone: req.query.hasPhone === 'true' ? true : req.query.hasPhone === 'false' ? false : undefined,
      isVerified: req.query.isVerified === 'true' ? true : req.query.isVerified === 'false' ? false : undefined,
    });

    if (!parsed.success) {
      handleValidationError(res, parsed.error);
      return;
    }

    const result = await leadService.getLeads(req.tenantId!, parsed.data);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/leads/stats — Lead statistics ──────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await leadService.getStats(req.tenantId!);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/leads/:id — Get single lead ────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const lead = await leadService.getLeadById(req.tenantId!, req.params.id!);
    res.json({ success: true, data: lead });
  } catch (err: any) {
    if (err.statusCode === 404) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    next(err);
  }
});

// ─── DELETE /api/leads/:id — Delete a lead ───────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    await leadService.deleteLead(req.tenantId!, req.params.id!);
    res.json({ success: true, message: 'Lead deleted' });
  } catch (err: any) {
    if (err.statusCode === 404) {
      res.status(404).json({ success: false, error: err.message });
      return;
    }
    next(err);
  }
});

// ─── GET /api/leads/export — Export leads as CSV ─────────────
router.get('/export/csv',
  limitMiddleware('exports_monthly', 'maxExportsMonthly'),
  async (req, res, next) => {
    try {
      const jobId = req.query.jobId as string | undefined;
      const rows = await leadService.exportLeads(req.tenantId!, jobId);

      // Set CSV headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="leads-${Date.now()}.csv"`);

      // CSV header row
      const headers = ['Vendor Name', 'Email', 'Phone', 'WhatsApp', 'Website', 'Location', 'Category', 'Product', 'Price', 'Quality Score', 'Source URL'];
      res.write(headers.join(',') + '\n');

      // CSV data rows
      for (const row of rows) {
        const values = [
          row.vendorName, row.email, row.phone, row.whatsapp, row.website,
          row.location, row.businessCategory, row.productName, row.price,
          row.qualityScore, row.listingUrl,
        ].map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`);
        res.write(values.join(',') + '\n');
      }

      res.end();
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/leads/export — Export leads with filter, format, and custom columns ────
router.post('/export',
  limitMiddleware('exports_monthly', 'maxExportsMonthly'),
  async (req, res, next) => {
    try {
      const { format = 'csv', query = {}, columns = [] } = req.body;

      // 1. Get filtered leads using the same criteria as getLeads but without pagination
      const db = getDb();
      const conditions: any[] = [eq(leads.tenantId, req.tenantId!)];

      const jobId = query.jobId as string | undefined;
      const search = query.search as string | undefined;
      const category = query.businessCategory as string | undefined;
      const hasEmail = query.hasEmail;
      const hasPhone = query.hasPhone;
      const minScore = query.minQualityScore ? parseInt(query.minQualityScore as string) : undefined;

      if (jobId) conditions.push(eq(leads.jobId, jobId));
      if (hasEmail === true || hasEmail === 'true') {
        conditions.push(sql`${leads.email} IS NOT NULL AND ${leads.email} != ''`);
      } else if (hasEmail === false || hasEmail === 'false') {
        conditions.push(sql`${leads.email} IS NULL OR ${leads.email} = ''`);
      }
      if (hasPhone === true || hasPhone === 'true') {
        conditions.push(sql`${leads.phone} IS NOT NULL AND ${leads.phone} != ''`);
      } else if (hasPhone === false || hasPhone === 'false') {
        conditions.push(sql`${leads.phone} IS NULL OR ${leads.phone} = ''`);
      }
      if (minScore !== undefined && !isNaN(minScore)) {
        conditions.push(gte(leads.qualityScore, minScore));
      }
      if (category) {
        conditions.push(eq(leads.businessCategory, category));
      }
      if (search) {
        conditions.push(or(
          ilike(leads.vendorName, `%${search}%`),
          ilike(leads.email, `%${search}%`),
          ilike(leads.phone, `%${search}%`),
          ilike(leads.location, `%${search}%`),
        ));
      }

      const rows = await db.select()
        .from(leads)
        .where(and(...conditions))
        .orderBy(desc(leads.createdAt));

      // 2. Format columns map
      const columnMap: Record<string, string> = {
        vendorName: 'Vendor / Company Name',
        email: 'Email Address',
        phone: 'Phone Number',
        whatsapp: 'WhatsApp Number',
        website: 'Website',
        location: 'Location',
        address: 'Street Address',
        businessCategory: 'Business Category',
        productName: 'Product Name',
        price: 'Price',
        description: 'Description',
        listingUrl: 'Source Page URL',
        qualityScore: 'Quality Score',
        isVerified: 'Verified Status',
      };

      const selectedKeys = columns.length > 0 ? columns : Object.keys(columnMap);

      if (format === 'json') {
        const mappedRows = rows.map((row: any) => {
          const mapped: Record<string, any> = {};
          selectedKeys.forEach((key: string) => {
            mapped[key] = row[key] ?? null;
          });
          return mapped;
        });

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="leads-${Date.now()}.json"`);
        res.json(mappedRows);
        return;
      }

      // Default CSV format
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="leads-${Date.now()}.csv"`);

      // Write header row using human-friendly labels
      const headers = selectedKeys.map((key: string) => columnMap[key] || key);
      res.write(headers.join(',') + '\n');

      // Write data rows
      for (const row of rows as any[]) {
        const values = selectedKeys.map((key: string) => {
          const val = row[key];
          if (val === null || val === undefined) return '""';
          return `"${val.toString().replace(/"/g, '""')}"`;
        });
        res.write(values.join(',') + '\n');
      }

      res.end();
    } catch (err) {
      next(err);
    }
  }
);

export default router;