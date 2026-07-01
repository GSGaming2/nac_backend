export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_UPLOAD_FILES = 5;