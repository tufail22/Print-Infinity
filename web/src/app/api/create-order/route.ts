// Canonical create-order endpoint is /api/payment/create-order.
// This route is maintained for backward compatibility and delegates directly to the canonical handler.
export { POST, dynamic } from "../payment/create-order/route";
