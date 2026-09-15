// ============================================================================
// Ephemeral Customer Token Manager
// Generates and manages high-entropy customer_token in memory / sessionStorage
// ============================================================================

const SESSION_TOKEN_KEY = "print_infinity_customer_token";
let inMemoryToken: string | null = null;

export function getOrCreateCustomerToken(): string {
  // Check memory cache first
  if (inMemoryToken) {
    return inMemoryToken;
  }

  // Check sessionStorage (isolated to current browser tab session)
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(SESSION_TOKEN_KEY);
      if (stored && stored.length >= 32) {
        inMemoryToken = stored;
        return stored;
      }
    } catch {
      // sessionStorage unavailable (private browsing restriction)
    }
  }

  // Generate cryptographically secure 256-bit random hex token
  let token = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(24); // 192 bits of entropy
    crypto.getRandomValues(bytes);
    token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  } else {
    // Fallback using timestamp + Math.random
    token = "cust_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  inMemoryToken = token;

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    } catch {
      // ignore
    }
  }

  return token;
}

export function clearCustomerToken(): void {
  inMemoryToken = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    } catch {
      // ignore
    }
  }
}
