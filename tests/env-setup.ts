// Set up environment variables for testing
process.env.TARGET_URLS = 'localhost:3001|localhost:3002';
process.env.PORT = '0';
process.env.TIMEOUT = '1000';
process.env.HOST = '0.0.0.0';
process.env.LOG_LEVEL = 'error';
process.env.HEALTH_CHECK_INTERVAL = '1000';
process.env.MAX_HEALTHY_STATUS = '499';
process.env.CIRCUIT_BREAKER_THRESHOLD = '3';