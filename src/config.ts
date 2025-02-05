export const config = {
    targets: process.env.TARGET_URLS?.split("|") || [],
    timeout: (process.env.TIMEOUT || 500) as number,
    port: (process.env.PORT || 7777) as number,
    host: (process.env.HOST || "0.0.0.0") as string,
    logLevel: (process.env.LOG_LEVEL || "info") as string,
};
