import type { MaintenanceRetentionPolicy, MaintenanceSweepStep, TenantScope } from '../domain/index.js';
import { serverMaintenanceRetentionPolicies } from '../domain/index.js';
import {
  systemClock,
  type AuditActor,
  type AuditLogPort,
  type Clock,
  type MaintenanceRetentionRepository,
  type MaintenanceSweepResult,
} from '../ports/index.js';

export interface MaintenanceSweepDependencies {
  retentionRepo: MaintenanceRetentionRepository;
  auditLog?: Pick<AuditLogPort, 'append'>;
  clock?: Clock;
  actor?: AuditActor;
  policies?: MaintenanceRetentionPolicy[];
}

const defaultActor: AuditActor = {
  type: 'service',
  id: 'billme-server-maintenance',
  displayName: 'billme-server-maintenance',
};

const subtractRetentionDays = (now: Date, retentionDays: number): string => {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  return cutoff.toISOString();
};

const executePolicy = async (
  scope: TenantScope,
  retentionRepo: MaintenanceRetentionRepository,
  now: Date,
  policy: MaintenanceRetentionPolicy,
): Promise<MaintenanceSweepStep> => {
  const deleteBefore = subtractRetentionDays(now, policy.retentionDays);

  switch (policy.key) {
    case 'released-number-reservations':
      return {
        key: policy.key,
        retentionDays: policy.retentionDays,
        deleteBefore,
        deletedCount: await retentionRepo.deleteReleasedNumberReservations(scope, {
          updatedBefore: deleteBefore,
        }),
      };
    case 'sqlite-import-runs':
      return {
        key: policy.key,
        retentionDays: policy.retentionDays,
        deleteBefore,
        deletedCount: await retentionRepo.deleteSqliteImportRuns(scope, {
          completedBefore: deleteBefore,
          statuses: [...policy.statuses],
        }),
      };
  }
};

export const runMaintenanceSweep = async (
  scope: TenantScope,
  dependencies: MaintenanceSweepDependencies,
): Promise<MaintenanceSweepResult> => {
  const clock = dependencies.clock ?? systemClock;
  const startedAt = clock.nowIso();
  const now = clock.now();
  const policies = dependencies.policies ?? [...serverMaintenanceRetentionPolicies];
  const steps: MaintenanceSweepStep[] = [];

  for (const policy of policies) {
    steps.push(await executePolicy(scope, dependencies.retentionRepo, now, policy));
  }

  const finishedAt = clock.nowIso();
  const totalDeleted = steps.reduce((sum, step) => sum + step.deletedCount, 0);

  if (dependencies.auditLog && totalDeleted > 0) {
    await dependencies.auditLog.append(scope, {
      occurredAt: finishedAt,
      action: 'maintenance.retention',
      reason: 'retention-policy',
      actor: dependencies.actor ?? defaultActor,
      subject: {
        entityType: 'tenant',
        entityId: scope.tenantId,
        tenantId: scope.tenantId,
      },
      change: {
        before: null,
        after: {
          totalDeleted,
          steps,
        },
      },
    });
  }

  return {
    startedAt,
    finishedAt,
    totalDeleted,
    policies,
    steps,
  };
};
