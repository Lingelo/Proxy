import request from 'supertest';
import * as http from 'http';
import { metrics } from '../../src/utils/metrics';

// Mock the config before importing proxy
jest.mock('../../src/config', () => ({
  config: {
    targets: ['localhost:3001', 'localhost:3002'],
    port: 0,
    host: '0.0.0.0',
    timeout: 1000,
    logLevel: 'error',
    healthCheckInterval: 1000,
    maxHealthyStatus: 499,
    circuitBreakerThreshold: 3,
  },
}));

import { startProxyServer } from '../../src/core/proxy';

describe('Proxy Integration Tests', () => {
  let proxyServer: http.Server;
  const mockServers: http.Server[] = [];
  let mockServerResponses: { [port: number]: (req: any, res: any) => void } = {};

  // Helper to create mock backend servers
  const createMockServer = (port: number, handler?: (req: any, res: any) => void) => {
    const server = http.createServer((req, res) => {
      if (handler) {
        handler(req, res);
      } else if (mockServerResponses[port]) {
        mockServerResponses[port](req, res);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: `Response from server on port ${port}`, port }));
      }
    });

    return new Promise<http.Server>(resolve => {
      server.listen(port, () => {
        mockServers.push(server);
        resolve(server);
      });
    });
  };

  beforeAll(async () => {
    // Create mock backend servers
    await createMockServer(3001);
    await createMockServer(3002);

    // Give servers time to start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  beforeEach(() => {
    metrics.reset();
    mockServerResponses = {};
  });

  afterAll(async () => {
    // Close proxy server
    if (proxyServer) {
      await new Promise<void>(resolve => {
        proxyServer.close(() => resolve());
      });
    }

    // Close all mock servers
    await Promise.all(
      mockServers.map(
        server =>
          new Promise<void>(resolve => {
            server.close(() => resolve());
          })
      )
    );
  });

  describe('Health and Metrics Endpoints', () => {
    test('should return health status', async () => {
      // Start proxy server for this test
      proxyServer = startProxyServer();
      const port = (proxyServer.address() as any)?.port;

      // Wait for health checks to run
      await new Promise(resolve => setTimeout(resolve, 1500));

      const response = await request(`http://localhost:${port}`).get('/health').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('details');
      expect(response.body.details).toHaveProperty('healthy_targets');
      expect(response.body.details).toHaveProperty('total_targets');
      expect(response.body.details.total_targets).toBe(2);
    });

    test('should return metrics', async () => {
      if (!proxyServer) {
        proxyServer = startProxyServer();
      }
      const port = (proxyServer.address() as any)?.port;

      const response = await request(`http://localhost:${port}`).get('/metrics').expect(200);

      expect(response.body).toHaveProperty('counters');
      expect(response.body).toHaveProperty('gauges');
      expect(response.body).toHaveProperty('histograms');
      expect(response.body).toHaveProperty('uptime_seconds');
      expect(response.body).toHaveProperty('memory_usage');
      expect(response.body).toHaveProperty('config_summary');
    });
  });

  describe('Request Proxying', () => {
    test('should proxy requests to healthy targets', async () => {
      if (!proxyServer) {
        proxyServer = startProxyServer();
      }
      const port = (proxyServer.address() as any)?.port;

      // Wait for health checks
      await new Promise(resolve => setTimeout(resolve, 1500));

      const response = await request(`http://localhost:${port}`).get('/test-endpoint').expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('port');
      expect([3001, 3002]).toContain(response.body.port);
    });

    test('should include request ID in headers', async () => {
      if (!proxyServer) {
        proxyServer = startProxyServer();
      }
      const port = (proxyServer.address() as any)?.port;

      await new Promise(resolve => setTimeout(resolve, 1500));

      const response = await request(`http://localhost:${port}`).get('/test-endpoint').expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    test('should handle POST requests with body', async () => {
      if (!proxyServer) {
        proxyServer = startProxyServer();
      }
      const port = (proxyServer.address() as any)?.port;

      // Configure mock server to echo back the request body
      mockServerResponses[3001] = (req, res) => {
        let body = '';
        req.on('data', (chunk: any) => (body += chunk));
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              method: req.method,
              body,
              headers: req.headers,
              port: 3001,
            })
          );
        });
      };

      mockServerResponses[3002] = mockServerResponses[3001];

      await new Promise(resolve => setTimeout(resolve, 1500));

      const testData = { test: 'data', number: 42 };
      const response = await request(`http://localhost:${port}`)
        .post('/api/test')
        .send(testData)
        .expect(200);

      expect(response.body.method).toBe('POST');
      expect(JSON.parse(response.body.body)).toEqual(testData);
    });
  });

  describe('Error Handling', () => {
    test('should return 503 when no targets are available', async () => {
      // Create a proxy with non-existent targets
      const originalTargets = process.env.TARGET_URLS;
      process.env.TARGET_URLS = 'localhost:9999|localhost:9998';

      const tempProxyServer = startProxyServer();
      const port = (tempProxyServer.address() as any)?.port;

      // Wait for health checks to determine servers are down
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await request(`http://localhost:${port}`).get('/test-endpoint').expect(503);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('No healthy targets available');

      // Cleanup
      await new Promise<void>(resolve => {
        tempProxyServer.close(() => resolve());
      });

      process.env.TARGET_URLS = originalTargets;
    });

    test('should handle target server errors gracefully', async () => {
      if (!proxyServer) {
        proxyServer = startProxyServer();
      }
      const port = (proxyServer.address() as any)?.port;

      // Configure mock servers to return errors
      mockServerResponses[3001] = (req, res) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      };

      mockServerResponses[3002] = (req, res) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      };

      await new Promise(resolve => setTimeout(resolve, 1500));

      const response = await request(`http://localhost:${port}`).get('/test-endpoint').expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Load Balancing', () => {
    test('should distribute requests across multiple targets', async () => {
      if (!proxyServer) {
        proxyServer = startProxyServer();
      }
      const port = (proxyServer.address() as any)?.port;

      await new Promise(resolve => setTimeout(resolve, 1500));

      const responses: number[] = [];

      // Make multiple requests
      for (let i = 0; i < 10; i++) {
        const response = await request(`http://localhost:${port}`)
          .get('/test-endpoint')
          .expect(200);

        responses.push(response.body.port);
      }

      // Should have requests distributed across both servers
      const port3001Count = responses.filter(p => p === 3001).length;
      const port3002Count = responses.filter(p => p === 3002).length;

      expect(port3001Count).toBeGreaterThan(0);
      expect(port3002Count).toBeGreaterThan(0);
      expect(port3001Count + port3002Count).toBe(10);
    });
  });
});
