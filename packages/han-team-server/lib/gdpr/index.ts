/**
 * GDPR Compliance Module
 *
 * Exports services for data export (portability) and account deletion (erasure).
 */

// Types
export type {
  DataExport,
  DataExportResult,
  DataExportStatus,
  DeletionRequest,
  DeletionRequestResult,
  DeletionRequestStatus,
  UserDeletionStatus,
  DeletionSummary,
  ExportArchive,
  ExportProfile,
  ExportTeam,
  ExportSession,
  ExportAuditEvent,
  GdprOperationContext,
} from "./types.ts";

// Export Service
export {
  ExportService,
  initExportService,
  getExportService,
  resetExportService,
  ExportError,
  ExportRateLimitError,
  ExportValidationError,
  ExportNotFoundError,
  ExportNotReadyError,
  ExportExpiredError,
  ExportDownloadLimitError,
} from "./export-service.ts";

// Deletion Service
export {
  DeletionService,
  initDeletionService,
  getDeletionService,
  resetDeletionService,
  DeletionError,
  DeletionAlreadyRequestedError,
  DeletionNotFoundError,
  DeletionTokenExpiredError,
  DeletionInvalidTokenError,
  DeletionCannotCancelError,
} from "./deletion-service.ts";
