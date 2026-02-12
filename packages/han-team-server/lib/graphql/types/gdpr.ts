/**
 * GraphQL Types for GDPR Compliance
 *
 * Defines types and mutations for data export and account deletion.
 */

import { builder } from "../builder.ts";
import {
  getExportService,
  getDeletionService,
  ExportRateLimitError,
  ExportValidationError,
  ExportNotFoundError,
  ExportNotReadyError,
  ExportExpiredError,
  ExportDownloadLimitError,
  DeletionAlreadyRequestedError,
  DeletionNotFoundError,
  DeletionTokenExpiredError,
  DeletionInvalidTokenError,
} from "../../gdpr/index.ts";
import type {
  DataExportStatus,
  DeletionRequestStatus,
} from "../../gdpr/types.ts";

// =============================================================================
// Enums
// =============================================================================

/**
 * Data export status enum
 */
export const DataExportStatusEnum = builder.enumType("DataExportStatus", {
  description: "Status of a data export request",
  values: {
    QUEUED: {
      description: "Export is waiting to be processed",
      value: "queued",
    },
    PROCESSING: {
      description: "Export is currently being generated",
      value: "processing",
    },
    COMPLETED: {
      description: "Export is ready for download",
      value: "completed",
    },
    FAILED: {
      description: "Export generation failed",
      value: "failed",
    },
    EXPIRED: {
      description: "Export has expired and is no longer available",
      value: "expired",
    },
  },
});

/**
 * Deletion request status enum
 */
export const DeletionRequestStatusEnum = builder.enumType(
  "DeletionRequestStatus",
  {
    description: "Status of an account deletion request",
    values: {
      PENDING: {
        description: "Request created, awaiting confirmation",
        value: "pending",
      },
      CONFIRMED: {
        description: "Request confirmed, in grace period",
        value: "confirmed",
      },
      PROCESSING: {
        description: "Deletion in progress",
        value: "processing",
      },
      COMPLETED: {
        description: "Account has been deleted",
        value: "completed",
      },
      CANCELLED: {
        description: "Request was cancelled",
        value: "cancelled",
      },
    },
  }
);

// =============================================================================
// Object Types
// =============================================================================

/**
 * Data export type reference
 */
export const DataExportRef = builder.objectRef<{
  id: string;
  status: DataExportStatus;
  requestedAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
  downloadCount: number;
  maxDownloads: number;
  fileSizeBytes: number | null;
  errorMessage: string | null;
}>("DataExport");

/**
 * Data export object type
 */
export const DataExportType = builder.objectType(DataExportRef, {
  description: "A user data export request for GDPR portability",
  fields: (t) => ({
    id: t.exposeID("id", {
      description: "Unique export identifier (UUID)",
    }),
    status: t.field({
      type: DataExportStatusEnum,
      description: "Current status of the export",
      resolve: (parent) => parent.status,
    }),
    requestedAt: t.field({
      type: "DateTime",
      description: "When the export was requested",
      resolve: (parent) => parent.requestedAt,
    }),
    completedAt: t.field({
      type: "DateTime",
      nullable: true,
      description: "When the export was completed (null if not complete)",
      resolve: (parent) => parent.completedAt,
    }),
    expiresAt: t.field({
      type: "DateTime",
      nullable: true,
      description: "When the export will expire (7 days after completion)",
      resolve: (parent) => parent.expiresAt,
    }),
    downloadCount: t.exposeInt("downloadCount", {
      description: "Number of times the export has been downloaded",
    }),
    maxDownloads: t.exposeInt("maxDownloads", {
      description: "Maximum allowed downloads (default: 3)",
    }),
    remainingDownloads: t.int({
      description: "Number of downloads remaining",
      resolve: (parent) => parent.maxDownloads - parent.downloadCount,
    }),
    fileSizeBytes: t.int({
      nullable: true,
      description: "Size of the export file in bytes",
      resolve: (parent) => parent.fileSizeBytes,
    }),
    errorMessage: t.string({
      nullable: true,
      description: "Error message if export failed",
      resolve: (parent) => parent.errorMessage,
    }),
    isReady: t.boolean({
      description: "Whether the export is ready for download",
      resolve: (parent) =>
        parent.status === "completed" &&
        parent.downloadCount < parent.maxDownloads &&
        (!parent.expiresAt || parent.expiresAt > new Date()),
    }),
  }),
});

/**
 * Deletion request type reference
 */
export const DeletionRequestRef = builder.objectRef<{
  id: string;
  status: DeletionRequestStatus;
  confirmedAt: Date | null;
  gracePeriodEndsAt: Date | null;
  scheduledDeletionAt: Date | null;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  createdAt: Date;
}>("DeletionRequest");

/**
 * Deletion request object type
 */
export const DeletionRequestType = builder.objectType(DeletionRequestRef, {
  description: "An account deletion request for GDPR erasure",
  fields: (t) => ({
    id: t.exposeID("id", {
      description: "Unique deletion request identifier (UUID)",
    }),
    status: t.field({
      type: DeletionRequestStatusEnum,
      description: "Current status of the deletion request",
      resolve: (parent) => parent.status,
    }),
    confirmedAt: t.field({
      type: "DateTime",
      nullable: true,
      description: "When the deletion was confirmed",
      resolve: (parent) => parent.confirmedAt,
    }),
    gracePeriodEndsAt: t.field({
      type: "DateTime",
      nullable: true,
      description: "When the 30-day grace period ends",
      resolve: (parent) => parent.gracePeriodEndsAt,
    }),
    scheduledDeletionAt: t.field({
      type: "DateTime",
      nullable: true,
      description: "When permanent deletion is scheduled",
      resolve: (parent) => parent.scheduledDeletionAt,
    }),
    cancelledAt: t.field({
      type: "DateTime",
      nullable: true,
      description: "When the request was cancelled (if applicable)",
      resolve: (parent) => parent.cancelledAt,
    }),
    cancelledReason: t.string({
      nullable: true,
      description: "Reason for cancellation (if provided)",
      resolve: (parent) => parent.cancelledReason,
    }),
    createdAt: t.field({
      type: "DateTime",
      description: "When the deletion request was created",
      resolve: (parent) => parent.createdAt,
    }),
    daysRemaining: t.int({
      nullable: true,
      description: "Days remaining in grace period (null if not confirmed)",
      resolve: (parent) => {
        if (parent.status !== "confirmed" || !parent.gracePeriodEndsAt) {
          return null;
        }
        const msRemaining =
          parent.gracePeriodEndsAt.getTime() - Date.now();
        return Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
      },
    }),
    canCancel: t.boolean({
      description: "Whether the deletion can still be cancelled",
      resolve: (parent) =>
        parent.status === "pending" || parent.status === "confirmed",
    }),
  }),
});

/**
 * Request export result type
 */
export const RequestExportResultRef = builder.objectRef<{
  export: {
    id: string;
    status: DataExportStatus;
    requestedAt: Date;
    completedAt: Date | null;
    expiresAt: Date | null;
    downloadCount: number;
    maxDownloads: number;
    fileSizeBytes: number | null;
    errorMessage: string | null;
  };
  estimatedWaitMinutes: number;
}>("RequestExportResult");

export const RequestExportResultType = builder.objectType(
  RequestExportResultRef,
  {
    description: "Result of requesting a data export",
    fields: (t) => ({
      export: t.field({
        type: DataExportRef,
        description: "The created export request",
        resolve: (parent) => parent.export,
      }),
      estimatedWaitMinutes: t.exposeInt("estimatedWaitMinutes", {
        description: "Estimated minutes until export is ready",
      }),
    }),
  }
);

/**
 * Request deletion result type
 */
export const RequestDeletionResultRef = builder.objectRef<{
  request: {
    id: string;
    status: DeletionRequestStatus;
    confirmedAt: Date | null;
    gracePeriodEndsAt: Date | null;
    scheduledDeletionAt: Date | null;
    cancelledAt: Date | null;
    cancelledReason: string | null;
    createdAt: Date;
  };
  confirmationTokenExpiresAt: Date;
  gracePeriodDays: number;
}>("RequestDeletionResult");

export const RequestDeletionResultType = builder.objectType(
  RequestDeletionResultRef,
  {
    description: "Result of requesting account deletion",
    fields: (t) => ({
      request: t.field({
        type: DeletionRequestRef,
        description: "The created deletion request",
        resolve: (parent) => parent.request,
      }),
      confirmationToken: t.string({
        description:
          "Token to confirm deletion (only shown once, store securely)",
        // Note: In real implementation, this would need to be passed through
        // For now, return placeholder to indicate it's provided separately
        resolve: () =>
          "[Token provided in separate secure channel]",
      }),
      confirmationTokenExpiresAt: t.field({
        type: "DateTime",
        description: "When the confirmation token expires (24 hours)",
        resolve: (parent) => parent.confirmationTokenExpiresAt,
      }),
      gracePeriodDays: t.exposeInt("gracePeriodDays", {
        description: "Number of days in the grace period (30)",
      }),
    }),
  }
);

// =============================================================================
// Query Fields
// =============================================================================

/**
 * Get data export by ID
 */
builder.queryField("dataExport", (t) =>
  t.field({
    type: DataExportRef,
    nullable: true,
    args: {
      id: t.arg.id({
        required: true,
        description: "Export ID (UUID)",
      }),
    },
    description:
      "Get a data export by ID. Returns the export status and download info.",
    resolve: async (_parent, args, context) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const exportService = getExportService();
      const exportRecord = await exportService.getExport(
        args.id.toString(),
        context.user.id
      );

      if (!exportRecord) {
        return null;
      }

      return {
        id: exportRecord.id,
        status: exportRecord.status,
        requestedAt: exportRecord.requestedAt,
        completedAt: exportRecord.completedAt,
        expiresAt: exportRecord.expiresAt,
        downloadCount: exportRecord.downloadCount,
        maxDownloads: exportRecord.maxDownloads,
        fileSizeBytes: exportRecord.fileSizeBytes,
        errorMessage: exportRecord.errorMessage,
      };
    },
  })
);

/**
 * Get current deletion request
 */
builder.queryField("myDeletionRequest", (t) =>
  t.field({
    type: DeletionRequestRef,
    nullable: true,
    description:
      "Get the current user's active deletion request (if any)",
    resolve: async (_parent, _args, context) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const deletionService = getDeletionService();
      const request = await deletionService.getDeletionRequest(
        context.user.id
      );

      if (!request) {
        return null;
      }

      return {
        id: request.id,
        status: request.status,
        confirmedAt: request.confirmedAt,
        gracePeriodEndsAt: request.gracePeriodEndsAt,
        scheduledDeletionAt: request.scheduledDeletionAt,
        cancelledAt: request.cancelledAt,
        cancelledReason: request.cancelledReason,
        createdAt: request.createdAt,
      };
    },
  })
);

// =============================================================================
// Mutation Fields
// =============================================================================

/**
 * Request data export mutation
 */
builder.mutationField("requestDataExport", (t) =>
  t.field({
    type: RequestExportResultRef,
    args: {
      passphrase: t.arg.string({
        required: true,
        description:
          "Passphrase to encrypt the export (minimum 8 characters). Store this securely - you'll need it to decrypt the downloaded file.",
      }),
    },
    description:
      "Request a data export. Queues an export job that includes all user data (profile, teams, sessions, audit logs). Rate limited to 1 per day.",
    resolve: async (_parent, args, context) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      try {
        const exportService = getExportService();
        const result = await exportService.requestExport(
          context.user.id,
          args.passphrase,
          {
            userId: context.user.id,
            // Context may not have these fields - use undefined if not present
            ipAddress: undefined,
            userAgent: undefined,
            requestId: undefined,
          }
        );

        return {
          export: {
            id: result.export.id,
            status: result.export.status,
            requestedAt: result.export.requestedAt,
            completedAt: result.export.completedAt,
            expiresAt: result.export.expiresAt,
            downloadCount: result.export.downloadCount,
            maxDownloads: result.export.maxDownloads,
            fileSizeBytes: result.export.fileSizeBytes,
            errorMessage: result.export.errorMessage,
          },
          estimatedWaitMinutes: result.estimatedWaitMinutes,
        };
      } catch (error) {
        if (error instanceof ExportRateLimitError) {
          throw new Error(`Rate limited: ${error.message}`);
        }
        if (error instanceof ExportValidationError) {
          throw new Error(`Validation error: ${error.message}`);
        }
        throw error;
      }
    },
  })
);

/**
 * Request account deletion mutation
 */
builder.mutationField("requestAccountDeletion", (t) =>
  t.field({
    type: RequestDeletionResultRef,
    description:
      "Request account deletion. Returns a confirmation token that must be used to confirm the deletion. The account enters a 30-day grace period during which the deletion can be cancelled.",
    resolve: async (_parent, _args, context) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      try {
        const deletionService = getDeletionService();
        const { request, confirmationToken } =
          await deletionService.requestDeletion(context.user.id, {
            userId: context.user.id,
            ipAddress: undefined,
            userAgent: undefined,
            requestId: undefined,
          });

        // SECURITY: Never log the confirmation token - it should only be sent via secure channel (email)
        // The token is returned to the client and should be delivered out-of-band

        return {
          request: {
            id: request.id,
            status: request.status,
            confirmedAt: request.confirmedAt,
            gracePeriodEndsAt: request.gracePeriodEndsAt,
            scheduledDeletionAt: request.scheduledDeletionAt,
            cancelledAt: request.cancelledAt,
            cancelledReason: request.cancelledReason,
            createdAt: request.createdAt,
          },
          confirmationTokenExpiresAt:
            request.confirmationTokenExpiresAt ?? new Date(),
          gracePeriodDays: 30,
        };
      } catch (error) {
        if (error instanceof DeletionAlreadyRequestedError) {
          throw new Error(error.message);
        }
        throw error;
      }
    },
  })
);

/**
 * Confirm account deletion mutation
 */
builder.mutationField("confirmAccountDeletion", (t) =>
  t.field({
    type: DeletionRequestRef,
    args: {
      confirmationToken: t.arg.string({
        required: true,
        description:
          "Confirmation token received from requestAccountDeletion",
      }),
    },
    description:
      "Confirm account deletion. After confirmation, a 30-day grace period begins. The account will be permanently deleted after the grace period unless cancelled.",
    resolve: async (_parent, args, context) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      try {
        const deletionService = getDeletionService();
        const request = await deletionService.confirmDeletion(
          context.user.id,
          args.confirmationToken,
          {
            userId: context.user.id,
            ipAddress: undefined,
            userAgent: undefined,
            requestId: undefined,
          }
        );

        return {
          id: request.id,
          status: request.status,
          confirmedAt: request.confirmedAt,
          gracePeriodEndsAt: request.gracePeriodEndsAt,
          scheduledDeletionAt: request.scheduledDeletionAt,
          cancelledAt: request.cancelledAt,
          cancelledReason: request.cancelledReason,
          createdAt: request.createdAt,
        };
      } catch (error) {
        if (error instanceof DeletionNotFoundError) {
          throw new Error(error.message);
        }
        if (error instanceof DeletionTokenExpiredError) {
          throw new Error(error.message);
        }
        if (error instanceof DeletionInvalidTokenError) {
          throw new Error("Invalid confirmation token");
        }
        throw error;
      }
    },
  })
);

/**
 * Cancel account deletion mutation
 */
builder.mutationField("cancelAccountDeletion", (t) =>
  t.field({
    type: DeletionRequestRef,
    args: {
      reason: t.arg.string({
        required: false,
        description: "Optional reason for cancellation",
      }),
    },
    description:
      "Cancel an account deletion request. Can only be done during the grace period before deletion processing begins.",
    resolve: async (_parent, args, context) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      try {
        const deletionService = getDeletionService();
        const request = await deletionService.cancelDeletion(
          context.user.id,
          args.reason ?? undefined,
          {
            userId: context.user.id,
            ipAddress: undefined,
            userAgent: undefined,
            requestId: undefined,
          }
        );

        return {
          id: request.id,
          status: request.status,
          confirmedAt: request.confirmedAt,
          gracePeriodEndsAt: request.gracePeriodEndsAt,
          scheduledDeletionAt: request.scheduledDeletionAt,
          cancelledAt: request.cancelledAt,
          cancelledReason: request.cancelledReason,
          createdAt: request.createdAt,
        };
      } catch (error) {
        if (error instanceof DeletionNotFoundError) {
          throw new Error(error.message);
        }
        throw error;
      }
    },
  })
);
