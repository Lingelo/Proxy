import { randomUUID } from 'crypto';
import * as http from 'http';

const REQUEST_ID_HEADER = 'x-request-id';

export function generateRequestId(): string {
    return randomUUID();
}

export function getRequestId(req: http.IncomingMessage): string {
    const existingId = req.headers[REQUEST_ID_HEADER];
    if (existingId && typeof existingId === 'string') {
        return existingId;
    }
    return generateRequestId();
}

export function setRequestId(req: http.IncomingMessage, res: http.ServerResponse, requestId: string): void {
    // Add to response headers for tracing
    res.setHeader(REQUEST_ID_HEADER, requestId);
    
    // Store in request for later use
    (req as any).requestId = requestId;
}