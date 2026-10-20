import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Express API Base & Route Validation', () => {
  it('returns 404 for unknown endpoints', async () => {
    const res = await request(app).get('/api/unknown-route-12345');
    expect(res.status).toBe(404);
  });

  it('rejects unauthenticated requests to protected /api/sos routes', async () => {
    const res = await request(app).get('/api/sos/active');
    expect(res.status).toBe(401);
  });

  it('rejects registration with missing mandatory fields', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'invalid-user@example.com'
      // Missing name, password, phone
    });
    expect([400, 422]).toContain(res.status);
  });
});
