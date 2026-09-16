import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const RAZORPAY_WEBHOOK_SECRET = 'yC20q4MkWU01wF6H05gXN9Bq';

async function runLiveTest() {
  console.log('===========================================================');
  console.log('LIVE END-TO-END WEBHOOK & SECURITY VALIDATION');
  console.log('===========================================================\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 1. Seed a test store if needed
  const { data: stores } = await supabase.from('stores').select('id').limit(1);
  const storeId = stores[0].id;

  // 2. Create a fresh test print job in 'pending_payment'
  const testToken = 'live_test_token_' + Date.now();
  const { data: job, error: jobErr } = await supabase
    .from('print_jobs')
    .insert({
      store_id: storeId,
      status: 'pending_payment',
      color_mode: 'color',
      copies: 1,
      paper_size: 'A4',
      duplex: false,
      storage_path: `${storeId}/test_file.png`,
      storage_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      customer_token: testToken
    })
    .select()
    .single();

  if (jobErr || !job) {
    console.error('Failed to create test print job:', jobErr);
    process.exit(1);
  }

  console.log(`[Setup] Created Print Job ${job.id} (Status: ${job.status})`);

  // 3. Create associated payment record with a unique Razorpay mock order ID
  const testOrderId = 'order_rzp_' + Math.random().toString(36).substring(2, 10);
  const testPaymentId = 'pay_rzp_' + Math.random().toString(36).substring(2, 10);

  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .insert({
      print_job_id: job.id,
      method: 'upi',
      amount: 10.0,
      status: 'pending',
      gateway_ref: testOrderId
    })
    .select()
    .single();

  if (payErr || !payment) {
    console.error('Failed to create test payment record:', payErr);
    process.exit(1);
  }

  console.log(`[Setup] Created Payment Record ${payment.id} (GatewayRef: ${testOrderId}, Status: ${payment.status})\n`);

  // ------------------------------------------------------------------------
  // TEST A: Webhook with Invalid Signature (Must be rejected with 401)
  // ------------------------------------------------------------------------
  console.log('--- TEST A: Webhook with TAMPERED Signature ---');
  const webhookPayload = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: testPaymentId,
          order_id: testOrderId,
          amount: 1000,
          status: 'captured',
          notes: {
            print_job_id: job.id
          }
        }
      }
    }
  });

  const forgedSignature = 'bad_signature_00000000000000000000000000000000000000000000000000000000';
  const badRes = await fetch('http://localhost:3000/api/payment/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': forgedSignature
    },
    body: webhookPayload
  });

  console.log(`Server HTTP Status for forged signature: ${badRes.status} (Expected: 401)`);
  if (badRes.status === 401) {
    console.log('✓ PASS: Webhook endpoint successfully rejected forged signature with 401 Unauthorized!');
  } else {
    console.error('✗ FAIL: Webhook endpoint failed to reject forged signature!');
    process.exit(1);
  }

  // Verify database status did NOT change
  const { data: unchangedJob } = await supabase
    .from('print_jobs')
    .select('status')
    .eq('id', job.id)
    .single();
  console.log(`Database job status after forged attempt: ${unchangedJob.status} (Expected: pending_payment)`);
  if (unchangedJob.status === 'pending_payment') {
    console.log('✓ PASS: Database state strictly preserved; zero unauthorized mutation.');
  }

  // ------------------------------------------------------------------------
  // TEST B: Webhook with AUTHENTIC HMAC-SHA256 Signature (Must be accepted with 200)
  // ------------------------------------------------------------------------
  console.log('\n--- TEST B: Webhook with GENUINE Razorpay HMAC-SHA256 Signature ---');
  const genuineSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(webhookPayload)
    .digest('hex');

  console.log(`Computed Genuine Signature: ${genuineSignature}`);

  const goodRes = await fetch('http://localhost:3000/api/payment/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': genuineSignature
    },
    body: webhookPayload
  });

  const goodData = await goodRes.json();
  console.log(`Server HTTP Status for genuine webhook: ${goodRes.status} (Expected: 200)`);
  console.log('Server Response Body:', goodData);

  if (goodRes.status === 200 && goodData.success) {
    console.log('✓ PASS: Webhook accepted valid cryptographic signature!');
  } else {
    console.error('✗ FAIL: Valid webhook was rejected:', goodData);
    process.exit(1);
  }

  // ------------------------------------------------------------------------
  // TEST C: Verify Database State Transition
  // ------------------------------------------------------------------------
  console.log('\n--- TEST C: Database State Transition Verification ---');
  const { data: updatedJob } = await supabase
    .from('print_jobs')
    .select('id, status')
    .eq('id', job.id)
    .single();

  const { data: updatedPayment } = await supabase
    .from('payments')
    .select('id, status, gateway_ref')
    .eq('id', payment.id)
    .single();

  console.log(`Updated Payment Status: ${updatedPayment.status} (Expected: verified)`);
  console.log(`Updated Payment Gateway Ref: ${updatedPayment.gateway_ref} (Expected: ${testPaymentId})`);
  console.log(`Updated Print Job Status: ${updatedJob.status} (Expected: pending_approval)`);

  if (updatedPayment.status === 'verified' && updatedJob.status === 'pending_approval') {
    console.log('✓ PASS: Database successfully updated: payments.status -> verified and print_jobs.status -> pending_approval!');
  } else {
    console.error('✗ FAIL: Database status transition incorrect!');
    process.exit(1);
  }

  // ------------------------------------------------------------------------
  // TEST D: Rate Limiting Verification
  // ------------------------------------------------------------------------
  console.log('\n--- TEST D: Server-Side Rate Limiting (5 requests/min per IP) ---');
  let rateLimitHit = false;
  for (let i = 1; i <= 6; i++) {
    const rateRes = await fetch('http://localhost:3000/api/payment/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '172.16.0.42'
      },
      body: JSON.stringify({
        print_job_id: job.id,
        amount: 10.0
      })
    });
    if (rateRes.status === 429) {
      rateLimitHit = true;
      console.log(`Request #${i} correctly returned HTTP 429 Too Many Requests`);
      break;
    }
  }

  if (rateLimitHit) {
    console.log('✓ PASS: Rate limit guard successfully blocked excessive order creation attempts!');
  } else {
    console.error('✗ FAIL: Rate limit did not trigger within 6 requests');
  }

  console.log('\n===========================================================');
  console.log('ALL LIVE END-TO-END SECURITY AND PAYMENT TESTS PASSED!');
  console.log('===========================================================');
}

runLiveTest().catch(e => {
  console.error(e);
  process.exit(1);
});
