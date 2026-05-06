import { createSingleTenantScope, type TenantScope } from '@billme/server-core';

export const DEFAULT_PRO_TENANT_ID = 'default';

export const createProTenantScope = (tenantId: string): TenantScope => createSingleTenantScope(tenantId, 'pro');

export const resolveRuntimeProTenantScope = (): TenantScope => {
  const tenantId = process.env.BILLME_TENANT_ID?.trim() || DEFAULT_PRO_TENANT_ID;
  return createProTenantScope(tenantId);
};

export const getTenantId = (scope: TenantScope): string => scope.tenantId;
