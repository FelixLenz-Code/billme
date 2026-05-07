import assert from 'node:assert/strict';
import test from 'node:test';
import { createBillmeServerClient } from './client.js';

test('createInvoice reserves and finalizes a number when none is provided', async () => {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const fetchImplementation: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });

    if (url.endsWith('/api/v1/lite/numbers/reserve')) {
      return new Response(JSON.stringify({ reservationId: 'res-1', number: 'RE-0001' }), { status: 200 });
    }
    if (url.endsWith('/api/v1/lite/invoices')) {
      return new Response(
        JSON.stringify({
          id: 'inv-1',
          tenantId: 'tenant-1',
          kind: 'invoice',
          number: 'RE-0001',
          client: 'Example GmbH',
          clientEmail: 'billing@example.com',
          date: '2026-05-06',
          dueDate: '2026-05-20',
          amount: 120,
          status: 'draft',
          dunningLevel: 0,
          items: [{ description: 'Implementation', quantity: 1, price: 120, total: 120 }],
          payments: [],
          history: [],
        }),
        { status: 200 },
      );
    }
    if (url.endsWith('/api/v1/lite/numbers/finalize')) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const client = createBillmeServerClient({
    baseUrl: 'http://127.0.0.1:3100',
    token: 'test-token',
    fetchImplementation,
  });

  const created = await client.createInvoice({
    reason: 'Create via CLI test',
    invoice: {
      kind: 'invoice',
      client: 'Example GmbH',
      clientEmail: 'billing@example.com',
      date: '2026-05-06',
      dueDate: '2026-05-20',
      amount: 120,
      status: 'draft',
      items: [{ description: 'Implementation', quantity: 1, price: 120, total: 120 }],
    },
  });

  assert.equal(created.number, 'RE-0001');
  assert.equal(calls.length, 3);
  assert.equal(calls[0]?.url, 'http://127.0.0.1:3100/api/v1/lite/numbers/reserve');
  assert.equal(calls[2]?.url, 'http://127.0.0.1:3100/api/v1/lite/numbers/finalize');
});

test('createInvoice releases a reserved number when document creation fails', async () => {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const fetchImplementation: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });

    if (url.endsWith('/api/v1/lite/numbers/reserve')) {
      return new Response(JSON.stringify({ reservationId: 'res-2', number: 'RE-0002' }), { status: 200 });
    }
    if (url.endsWith('/api/v1/lite/invoices')) {
      return new Response(JSON.stringify({ message: 'boom' }), { status: 500 });
    }
    if (url.endsWith('/api/v1/lite/numbers/release')) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };

  const client = createBillmeServerClient({
    baseUrl: 'http://127.0.0.1:3100',
    token: 'test-token',
    fetchImplementation,
  });

  await assert.rejects(
    () =>
      client.createInvoice({
        reason: 'Create via CLI test',
        invoice: {
          kind: 'invoice',
          client: 'Example GmbH',
          clientEmail: 'billing@example.com',
          date: '2026-05-06',
          dueDate: '2026-05-20',
          amount: 120,
          status: 'draft',
          items: [{ description: 'Implementation', quantity: 1, price: 120, total: 120 }],
        },
      }),
    /boom/,
  );

  assert.equal(calls.length, 3);
  assert.equal(calls[2]?.url, 'http://127.0.0.1:3100/api/v1/lite/numbers/release');
});
