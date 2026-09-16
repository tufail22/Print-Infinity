// ============================================================================
// Print Infinity Pricing Configuration (Easily Editable)
// ============================================================================

export interface PricingConfig {
  currencySymbol: string;
  currencyCode: string;
  rates: {
    bwPerPage: number;       // ₹3.00 per B&W page
    colorPerPage: number;    // ₹10.00 per Color page
  };
  paperSizeMultipliers: Record<string, number>;
  qualityMultipliers: Record<string, number>;
  duplexDiscountPercent: number; // 10% discount on total for double-sided prints
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  currencySymbol: "₹",
  currencyCode: "INR",
  rates: {
    bwPerPage: 3.0,
    colorPerPage: 10.0,
  },
  paperSizeMultipliers: {
    A4: 1.0,
    Letter: 1.0,
    A5: 0.8,
    Legal: 1.25,
    B5: 1.0,
    A3: 2.0,
    Tabloid: 2.2,
    Custom: 1.5,
  },
  qualityMultipliers: {
    eco: 0.9,
    standard: 1.0,
    high: 1.2,
    best: 1.5,
  },
  duplexDiscountPercent: 10,
};

export interface PriceCalculationParams {
  totalPages: number;
  copies: number;
  colorMode: "color" | "bw";
  paperSize: string;
  duplex: boolean;
  quality?: "eco" | "standard" | "high" | "best";
  pagesPerSheet?: number;
}

export interface PriceBreakdown {
  basePageRate: number;
  effectivePages: number;
  subtotal: number;
  paperMultiplier: number;
  qualityMultiplier: number;
  discountAmount: number;
  total: number;
  formattedTotal: string;
}

export function calculateEstimatedPrice(
  params: PriceCalculationParams,
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): PriceBreakdown {
  const {
    totalPages,
    copies,
    colorMode,
    paperSize,
    duplex,
    quality = "standard",
    pagesPerSheet = 1,
  } = params;

  const baseRate =
    colorMode === "color" ? config.rates.colorPerPage : config.rates.bwPerPage;

  // Pages compressed by n-up printing
  const sheetsNeeded = Math.ceil(Math.max(1, totalPages) / Math.max(1, pagesPerSheet));
  const effectivePages = sheetsNeeded * Math.max(1, copies);

  const paperMult = config.paperSizeMultipliers[paperSize] ?? 1.0;
  const qualityMult = config.qualityMultipliers[quality] ?? 1.0;

  let subtotal = effectivePages * baseRate * paperMult * qualityMult;

  let discount = 0;
  if (duplex && sheetsNeeded > 1) {
    discount = (subtotal * config.duplexDiscountPercent) / 100;
  }

  const finalTotal = Math.max(1, Math.round((subtotal - discount) * 100) / 100);

  return {
    basePageRate: baseRate,
    effectivePages,
    subtotal: Math.round(subtotal * 100) / 100,
    paperMultiplier: paperMult,
    qualityMultiplier: qualityMult,
    discountAmount: Math.round(discount * 100) / 100,
    total: finalTotal,
    formattedTotal: `${config.currencySymbol}${finalTotal.toFixed(2)}`,
  };
}
