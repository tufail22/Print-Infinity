-- ============================================================================
-- Migration: Fix verify_payment_and_advance_job Idempotency
-- Prevents state regression when payment verification is retried on jobs
-- that are already in 'approved', 'printing', or 'completed' status.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_payment_and_advance_job(
    p_print_job_id uuid,
    p_customer_token text,
    p_gateway_ref text DEFAULT 'VERIFIED_CLIENT'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_job RECORD;
    v_result JSONB;
BEGIN
    -- 1. Check job exists
    SELECT * INTO v_job
    FROM public.print_jobs
    WHERE id = p_print_job_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Job not found');
    END IF;

    -- 2. Verify token if token is provided & stored
    IF v_job.customer_token IS NOT NULL AND p_customer_token IS NOT NULL AND v_job.customer_token <> p_customer_token THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized customer token');
    END IF;

    -- 3. Idempotently update payment record to verified
    UPDATE public.payments
    SET status = 'verified',
        gateway_ref = COALESCE(p_gateway_ref, 'VERIFIED_ONLINE'),
        updated_at = NOW()
    WHERE print_job_id = p_print_job_id;

    -- 4. Advance print job ONLY if still pending_payment (Idempotency guard)
    IF v_job.status = 'pending_payment' THEN
        UPDATE public.print_jobs
        SET status = 'pending_approval',
            updated_at = NOW()
        WHERE id = p_print_job_id
          AND status = 'pending_payment'
        RETURNING to_jsonb(print_jobs.*) INTO v_result;
    ELSE
        -- Retain current progressive status (e.g. approved, printing, completed)
        SELECT to_jsonb(pj.*) INTO v_result
        FROM public.print_jobs pj
        WHERE pj.id = p_print_job_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'job', v_result);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.verify_payment_and_advance_job(uuid, text, text) TO anon, authenticated, service_role;
