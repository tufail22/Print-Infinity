// ============================================================================
// Print Infinity Domain Types
// ============================================================================

export type PaymentMethod = "cash" | "upi";
export type PaymentStatus = "pending" | "verified" | "failed";

export type JobStatus =
  | "pending_payment"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "printing"
  | "completed"
  | "expired"
  | "failed";

export type ColorMode = "color" | "bw";
export type Orientation = "portrait" | "landscape";
export type PageRangeType = "all" | "odd" | "even" | "custom";
export type MultiPageOutput = "singly" | "multiple" | "poster" | "booklet";
export type PrintQuality = "eco" | "standard" | "high" | "best";
export type PaperMargin = "normal" | "narrow" | "wide" | "none";
export type ContentAlignment = "center" | "top-left";
export type ImageScaling = "fit" | "fill" | "actual" | "custom";

export interface CustomPaperSize {
  width: number;
  height: number;
  unit: "cm" | "inch";
}

export type PhotoSize =
  | "Full page"
  | "8 x 10 in."
  | "5 x 7 in."
  | "4 x 6 in."
  | "100 x 148 mm (Hagaki)"
  | "3.5 x 5 in."
  | "2 x 3 in. (Wallet)"
  | "6 x 8 cm (Wallet)"
  | "Custom Size";

export interface DetailedPrintSettings {
  colorMode: ColorMode;
  copies: number;
  paperSize: string;
  customPaperSize?: CustomPaperSize;
  photoSize?: PhotoSize;
  customPhotoSize?: CustomPaperSize;
  orientation: Orientation;
  duplex: boolean;
  duplexEdge?: "long" | "short";
  pageRangeType: PageRangeType;
  customPageRange?: string;
  reverseOrder: boolean;
  pagesPerSheet: number;
  imageScaling: ImageScaling;
  imageScalePercent?: number;
  margin: PaperMargin;
  alignment: ContentAlignment;
  multiPageOutput: MultiPageOutput;
  quality: PrintQuality;
  autoTuned?: boolean;
}

export interface UploadedFileItem {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  formattedSize: string;
  type: string;
  totalPages: number;
  previewUrl?: string;
  uploadProgress: number; // 0 to 100
  uploadedStoragePath?: string;
  isCompressed?: boolean;
}

export interface StoreInfo {
  id: string;
  name: string;
  address?: string;
  active: boolean;
}

export interface PrintJobRecord {
  id: string;
  store_id: string;
  status: JobStatus;
  color_mode: ColorMode;
  copies: number;
  paper_size: string;
  duplex: boolean;
  storage_path: string | null;
  storage_expires_at: string | null;
  customer_token: string;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentRecord {
  id: string;
  print_job_id: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  gateway_ref: string | null;
  created_at: string;
  updated_at: string;
}
