-- Add priority column to printers table for fallback ordering
ALTER TABLE public.printers 
ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 1;

-- Add index on (store_id, type, priority) for fast priority-ordered queries
CREATE INDEX IF NOT EXISTS idx_printers_store_type_priority 
ON public.printers (store_id, type, priority);
