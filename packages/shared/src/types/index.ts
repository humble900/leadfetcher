// ─── API Response Types ──────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Usage Info ──────────────────────────────────────────────
export interface UsageInfo {
  leadsMonthly: { used: number; limit: number; percentage: number };
  jobsMonthly: { used: number; limit: number; percentage: number };
  exportsMonthly: { used: number; limit: number; percentage: number };
  concurrentJobs: { used: number; limit: number; percentage: number };
  llmTokensMonthly: { used: number; limit: number; percentage: number };
}

// ─── SSE Event Types ─────────────────────────────────────────
export type SSEEventType =
  | 'progress'
  | 'lead'
  | 'agent_activity'
  | 'error'
  | 'completed'
  | 'paused'
  | 'cancelled';

export interface SSEEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

// ─── Agent Activity ──────────────────────────────────────────
export interface AgentActivity {
  agent: 'orchestrator' | 'discovery' | 'pagination' | 'extractor' | 'validator' | 'enricher' | 'reviewer';
  action: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ─── Site Profile ────────────────────────────────────────────
export interface SiteProfile {
  id: string;
  domain: string;
  displayName?: string;
  selectors: {
    vendorName?: string;
    phone?: string;
    email?: string;
    price?: string;
    location?: string;
    businessCategory?: string;
    listingLinks?: string;
    nextPage?: string;
    cardContainer?: string;
  };
  pagination: {
    type: 'url_pattern' | 'next_button' | 'load_more' | 'infinite_scroll';
    urlPattern?: string;
    nextSelector?: string;
    loadMoreSelector?: string;
    maxPages?: number;
  };
  requiresJs: boolean;
  notes?: string;
  lastVerified?: string;
}

// ─── Auth Response ───────────────────────────────────────────
export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  tenant: {
    id: string;
    name: string;
    planId: string;
  };
}
