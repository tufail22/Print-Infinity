-- ============================================================================
-- Print Infinity: Core Backend Schema Migration
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. Helper function for updated_at timestamps
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 2. Stores Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TRIGGER set_stores_updated_at
    BEFORE UPDATE ON public.stores
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Printers Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.printers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('color', 'bw')),
    connection TEXT NOT NULL CHECK (connection IN ('usb', 'wifi')),
    windows_printer_name TEXT NOT NULL,
    is_online BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_printers_store_id ON public.printers(store_id);

CREATE TRIGGER set_printers_updated_at
    BEFORE UPDATE ON public.printers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Print Jobs Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (
        status IN (
            'pending_payment',
            'pending_approval',
            'approved',
            'rejected',
            'printing',
            'completed',
            'expired'
        )
    ),
    color_mode TEXT NOT NULL CHECK (color_mode IN ('color', 'bw')),
    copies INT NOT NULL DEFAULT 1 CHECK (copies > 0),
    paper_size TEXT NOT NULL DEFAULT 'A4',
    duplex BOOLEAN NOT NULL DEFAULT FALSE,
    storage_path TEXT,
    storage_expires_at TIMESTAMPTZ,
    customer_token TEXT UNIQUE NOT NULL,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_store_status ON public.print_jobs(store_id, status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_customer_token ON public.print_jobs(customer_token);
CREATE INDEX IF NOT EXISTS idx_print_jobs_storage_expires ON public.print_jobs(storage_expires_at) WHERE storage_path IS NOT NULL;

CREATE TRIGGER set_print_jobs_updated_at
    BEFORE UPDATE ON public.print_jobs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Payments Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    print_job_id UUID NOT NULL REFERENCES public.print_jobs(id) ON DELETE CASCADE,
    method TEXT NOT NULL CHECK (method IN ('cash', 'upi')),
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'failed')),
    gateway_ref TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_print_job_id ON public.payments(print_job_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_ref ON public.payments(gateway_ref);

CREATE TRIGGER set_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Storekeepers Table (references auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.storekeepers (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'storekeeper',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_storekeepers_store_id ON public.storekeepers(store_id);

CREATE TRIGGER set_storekeepers_updated_at
    BEFORE UPDATE ON public.storekeepers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 7. Private Storage Bucket: print-uploads
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'print-uploads',
    'print-uploads',
    FALSE,
    52428800, -- 50MB max file size
    ARRAY[
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 8. Enable Row Level Security (RLS) on All Tables
-- ----------------------------------------------------------------------------
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storekeepers ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 9. RLS Policies: stores
-- ----------------------------------------------------------------------------
-- Anonymous customers and authenticated users can view active stores (e.g. after QR scan)
CREATE POLICY "Public can view active stores"
    ON public.stores FOR SELECT
    USING (active = TRUE);

-- Storekeepers can view their assigned store regardless of active status
CREATE POLICY "Storekeepers can view assigned store"
    ON public.stores FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.storekeepers
            WHERE storekeepers.id = auth.uid()
              AND storekeepers.store_id = stores.id
        )
    );

-- ----------------------------------------------------------------------------
-- 10. RLS Policies: printers
-- ----------------------------------------------------------------------------
-- Storekeepers can SELECT printers only where store_id matches their own
CREATE POLICY "Storekeepers can view printers of their store"
    ON public.printers FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.storekeepers
            WHERE storekeepers.id = auth.uid()
              AND storekeepers.store_id = printers.store_id
        )
    );

-- Storekeepers can UPDATE printers only where store_id matches their own
CREATE POLICY "Storekeepers can update printers of their store"
    ON public.printers FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.storekeepers
            WHERE storekeepers.id = auth.uid()
              AND storekeepers.store_id = printers.store_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.storekeepers
            WHERE storekeepers.id = auth.uid()
              AND storekeepers.store_id = printers.store_id
        )
    );

-- ----------------------------------------------------------------------------
-- 11. RLS Policies: print_jobs
-- ----------------------------------------------------------------------------
-- Anonymous customers can INSERT a print_job
CREATE POLICY "Customers can insert print jobs"
    ON public.print_jobs FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Anonymous customers can SELECT ONLY the single row matching their customer_token
-- Checked via x-customer-token header or JWT claim
CREATE POLICY "Customers can select job matching customer_token"
    ON public.print_jobs FOR SELECT
    TO anon, authenticated
    USING (
        customer_token IS NOT NULL
        AND customer_token = COALESCE(
            (current_setting('request.headers', true)::json->>'x-customer-token'),
            (current_setting('request.jwt.claims', true)::json->>'customer_token')
        )
    );

-- Storekeepers can SELECT only print_jobs where store_id matches their own store
CREATE POLICY "Storekeepers can view print jobs of their store"
    ON public.print_jobs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.storekeepers
            WHERE storekeepers.id = auth.uid()
              AND storekeepers.store_id = print_jobs.store_id
        )
    );

-- Storekeepers can UPDATE only print_jobs where store_id matches their own store
CREATE POLICY "Storekeepers can update print jobs of their store"
    ON public.print_jobs FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.storekeepers
            WHERE storekeepers.id = auth.uid()
              AND storekeepers.store_id = print_jobs.store_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.storekeepers
            WHERE storekeepers.id = auth.uid()
              AND storekeepers.store_id = print_jobs.store_id
        )
    );

-- ----------------------------------------------------------------------------
-- 12. RLS Policies: payments
-- ----------------------------------------------------------------------------
-- Anonymous customers can INSERT payment records for jobs
CREATE POLICY "Customers can insert payments"
    ON public.payments FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Anonymous customers can SELECT payments only for the job matching their customer_token
CREATE POLICY "Customers can select payment for their job"
    ON public.payments FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.print_jobs
            WHERE print_jobs.id = payments.print_job_id
              AND print_jobs.customer_token IS NOT NULL
              AND print_jobs.customer_token = COALESCE(
                  (current_setting('request.headers', true)::json->>'x-customer-token'),
                  (current_setting('request.jwt.claims', true)::json->>'customer_token')
              )
        )
    );

-- Storekeepers can SELECT payments for print jobs in their store
CREATE POLICY "Storekeepers can view payments of their store"
    ON public.payments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.print_jobs
            JOIN public.storekeepers ON storekeepers.store_id = print_jobs.store_id
            WHERE print_jobs.id = payments.print_job_id
              AND storekeepers.id = auth.uid()
        )
    );

-- Storekeepers can UPDATE payments for print jobs in their store (e.g., verifying cash)
CREATE POLICY "Storekeepers can update payments of their store"
    ON public.payments FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.print_jobs
            JOIN public.storekeepers ON storekeepers.store_id = print_jobs.store_id
            WHERE print_jobs.id = payments.print_job_id
              AND storekeepers.id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.print_jobs
            JOIN public.storekeepers ON storekeepers.store_id = print_jobs.store_id
            WHERE print_jobs.id = payments.print_job_id
              AND storekeepers.id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- 13. RLS Policies: storekeepers
-- ----------------------------------------------------------------------------
-- Storekeepers can view only their own record
CREATE POLICY "Storekeepers can view own record"
    ON public.storekeepers FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- ----------------------------------------------------------------------------
-- 14. RLS Policies: Storage Objects (print-uploads bucket)
-- ----------------------------------------------------------------------------
-- Customers can upload objects into print-uploads bucket
CREATE POLICY "Allow uploads to print-uploads bucket"
    ON storage.objects FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'print-uploads');

-- Storekeepers can access objects belonging to their store's print jobs
CREATE POLICY "Storekeepers can access store print files"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'print-uploads'
        AND EXISTS (
            SELECT 1 FROM public.print_jobs
            JOIN public.storekeepers ON storekeepers.store_id = print_jobs.store_id
            WHERE print_jobs.storage_path = storage.objects.name
              AND storekeepers.id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- 15. Realtime (Postgres Changes) on print_jobs
-- ----------------------------------------------------------------------------
ALTER TABLE public.print_jobs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;

-- ----------------------------------------------------------------------------
-- 16. Secure Token-Based Job Lookup Helper (RPC)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_customer_print_job(p_customer_token TEXT)
RETURNS SETOF public.print_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * FROM public.print_jobs
    WHERE customer_token = p_customer_token
    LIMIT 1;
$$;

-- Grant execution to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_customer_print_job(TEXT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 17. Scheduled Expiration Cleanup Function (called via pg_cron or Edge Function)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_outdated_print_jobs()
RETURNS TABLE (expired_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    affected_rows INT;
BEGIN
    UPDATE public.print_jobs
    SET status = 'expired'
    WHERE storage_expires_at < TIMEZONE('utc', NOW())
      AND status NOT IN ('completed', 'expired');

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN QUERY SELECT affected_rows;
END;
$$;
