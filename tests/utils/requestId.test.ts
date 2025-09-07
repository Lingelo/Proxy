import { generateRequestId, getRequestId, setRequestId } from '../../src/utils/requestId';
import * as http from 'http';

describe('RequestId utilities', () => {
  describe('generateRequestId', () => {
    test('should generate a valid UUID', () => {
      const requestId = generateRequestId();

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(requestId).toMatch(uuidRegex);
    });

    test('should generate unique IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('getRequestId', () => {
    test('should return existing request ID from headers', () => {
      const existingId = 'existing-request-id';
      const req = {
        headers: {
          'x-request-id': existingId,
        },
      } as unknown as http.IncomingMessage;

      const result = getRequestId(req);
      expect(result).toBe(existingId);
    });

    test('should generate new ID when header is missing', () => {
      const req = {
        headers: {},
      } as unknown as http.IncomingMessage;

      const result = getRequestId(req);

      // Should be a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result).toMatch(uuidRegex);
    });

    test('should generate new ID when header is not a string', () => {
      const req = {
        headers: {
          'x-request-id': ['array-value'],
        },
      } as unknown as http.IncomingMessage;

      const result = getRequestId(req);

      // Should be a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result).toMatch(uuidRegex);
    });
  });

  describe('setRequestId', () => {
    test('should set request ID in response header and request object', () => {
      const requestId = 'test-request-id';
      const req = {} as unknown as http.IncomingMessage;
      const res = {
        setHeader: jest.fn(),
      } as any as http.ServerResponse;

      setRequestId(req, res, requestId);

      // Check response header was set
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', requestId);

      // Check request object was updated
      expect((req as any).requestId).toBe(requestId);
    });
  });
});
