import './config/dotenv.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { getEnv } from './config/env.js';
import { getRedis } from './config/redis.js';
import { closeDb } from './config/database.js';
import { closeRedis } from './config/redis.js';
import { logger } from './utils/logger.js';

// Middleware
import { authMiddleware } from './middleware/auth.middleware.js';
import { tenantMiddleware } from './middleware/tenant.middleware.js';
import { rateLimitMiddleware } from './middleware/limit.middleware.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import publicRoutes from './routes/public.routes.js';
import jobsRoutes from './routes/jobs.routes.js';
import leadsRoutes from './routes/leads.routes.js';
import usageRoutes from './routes/usage.routes.js';
import adminRoutes from './routes/admin.routes.js';

const env = getEnv();
const app = express();

// ─── Global Middleware ───────────────────────────────────────
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true, // Required for httpOnly cookies
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Rate limiting on all routes
app.use(rateLimitMiddleware);

// ─── Health Check (public) ───────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Auth Routes (public) ────────────────────────────────────
app.use('/api/auth', authRoutes);

// ─── Public Sandboxed Routes ─────────────────────────────────
app.use('/api/public', publicRoutes);

// ─── Protected Routes ────────────────────────────────────────
// All routes below require authentication + tenant context
app.use('/api/jobs', authMiddleware, tenantMiddleware, jobsRoutes);
app.use('/api/leads', authMiddleware, tenantMiddleware, leadsRoutes);
app.use('/api/usage', authMiddleware, tenantMiddleware, usageRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);

// ─── Error Handler (must be last) ────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────
const PORT = env.PORT || 3001;

app.listen(PORT, () => {
  logger.info({ port: PORT, env: env.NODE_ENV }, '🚀 API server started');
});

// ─── Graceful Shutdown ───────────────────────────────────────
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down...');
  await closeDb();
  await closeRedis();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;