-- ============================================================================
-- Migration: Add approve_print_job RPC function
-- Allows secure transition of print_jobs to 'approved' and payment verification
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_print_job(
    p_print_job_id uuid,
    p_rejection_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_job public.print_jobs;
BEGIN
    UPDATE public.print_jobs
    SET status = 'approved',
        updated_at = NOW(),
        rejection_reason = p_rejection_reason
    WHERE id = p_print_job_id
    RETURNING * INTO v_job;

    IF v_job.id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Job not found');
    END IF;

    UPDATE public.payments
    SET status = 'verified',
        updated_at = NOW()
    WHERE print_job_id = p_print_job_id;

    RETURN json_build_object('success', true, 'job', row_to_json(v_job));
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_print_job(uuid, text) TO anon, authenticated, service_role;
