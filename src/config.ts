import { validateConfiguration, formatValidationErrors } from "./utils/validation";

// Parse environment variables with defaults
const rawConfig = {
    targets: process.env.TARGET_URLS?.split("|") || [],
    timeout: parseInt(process.env.TIMEOUT || "5000", 10),
    port: parseInt(process.env.PORT || "7777", 10),
    host: (process.env.HOST || "0.0.0.0") as string,
    logLevel: (process.env.LOG_LEVEL || "info") as string,
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || "30000", 10),
    maxHealthyStatus: parseInt(process.env.MAX_HEALTHY_STATUS || "499", 10),
    circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || "3", 10),
};

// Validate configuration
const validationResult = validateConfiguration(rawConfig);

if (!validationResult.isValid) {
    console.error('❌ Configuration validation failed:');
    console.error(formatValidationErrors(validationResult.errors));
    console.error('\nPlease check your .env file or environment variables.');
    console.error('See .env-example for reference configuration.');
    process.exit(1);
}

export const config = rawConfig;
