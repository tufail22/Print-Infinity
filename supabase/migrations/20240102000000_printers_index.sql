-- ============================================================================
-- Migration: Add composite index on printers(store_id, type, is_online)
-- Accelerates Windows agent auto-printer selection queries.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_printers_store_type_online 
    ON public.printers(store_id, type, is_online);
