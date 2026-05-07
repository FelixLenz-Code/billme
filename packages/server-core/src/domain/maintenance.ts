import { z } from 'zod';
import { isoDateTimeSchema } from './foundations.js';

export const sqliteImportRunRetentionStatusSchema = z.enum(['completed', 'failed']);
export type SqliteImportRunRetentionStatus = z.infer<typeof sqliteImportRunRetentionStatusSchema>;

export const maintenanceRetentionPolicyKeySchema = z.enum([
  'released-number-reservations',
  'sqlite-import-runs',
]);
export type MaintenanceRetentionPolicyKey = z.infer<typeof maintenanceRetentionPolicyKeySchema>;

export const releasedNumberReservationsRetentionPolicySchema = z.object({
  key: z.literal('released-number-reservations'),
  description: z.string().trim().min(1),
  retentionDays: z.number().int().positive(),
  status: z.literal('released'),
  cutoffField: z.literal('updatedAt'),
});
export type ReleasedNumberReservationsRetentionPolicy = z.infer<
  typeof releasedNumberReservationsRetentionPolicySchema
>;

export const sqliteImportRunsRetentionPolicySchema = z.object({
  key: z.literal('sqlite-import-runs'),
  description: z.string().trim().min(1),
  retentionDays: z.number().int().positive(),
  statuses: z.array(sqliteImportRunRetentionStatusSchema).min(1),
  cutoffField: z.literal('completedAt'),
});
export type SqliteImportRunsRetentionPolicy = z.infer<typeof sqliteImportRunsRetentionPolicySchema>;

export const maintenanceRetentionPolicySchema = z.discriminatedUnion('key', [
  releasedNumberReservationsRetentionPolicySchema,
  sqliteImportRunsRetentionPolicySchema,
]);
export type MaintenanceRetentionPolicy = z.infer<typeof maintenanceRetentionPolicySchema>;

export const maintenanceRetentionPoliciesSchema = z.array(maintenanceRetentionPolicySchema);

export const maintenanceSweepStepSchema = z.object({
  key: maintenanceRetentionPolicyKeySchema,
  retentionDays: z.number().int().positive(),
  deleteBefore: isoDateTimeSchema,
  deletedCount: z.number().int().nonnegative(),
});
export type MaintenanceSweepStep = z.infer<typeof maintenanceSweepStepSchema>;

export const serverMaintenanceRetentionPolicies = maintenanceRetentionPoliciesSchema.parse([
  {
    key: 'released-number-reservations',
    description: 'Delete only reservations already marked as released after a 90 day cooling-off window.',
    retentionDays: 90,
    status: 'released',
    cutoffField: 'updatedAt',
  },
  {
    key: 'sqlite-import-runs',
    description: 'Delete completed or failed SQLite import bookkeeping rows after a 365 day retention window.',
    retentionDays: 365,
    statuses: ['completed', 'failed'],
    cutoffField: 'completedAt',
  },
]);
