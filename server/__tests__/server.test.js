import request from 'supertest';
import app from '../index.js';

describe('Server', () => {
  it('should respond to health check', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'OK');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
  });

  it('should return 404 for unknown routes', async () => {
    const response = await request(app)
      .get('/unknown-route')
      .expect(404);
    
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error', 'Route not found');
  });
}); 