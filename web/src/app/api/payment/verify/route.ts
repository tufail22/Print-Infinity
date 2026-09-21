// Canonical verify endpoint is /api/verify-payment.
// This route is maintained for backward compatibility and delegates directly to the canonical handler.
export { POST, dynamic } from "../../verify-payment/route";
