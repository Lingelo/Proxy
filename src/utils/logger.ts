import winston from 'winston'
import {config} from "../config";

const logger = winston.createLogger({
	level: config.logLevel,
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.json()
	),
	defaultMeta: {
		service: 'proxy'
	},
	transports: [
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
					const reqId = requestId ? `[${requestId}] ` : '';
					const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
					return `${timestamp} [${level}]: ${reqId}${message}${metaStr}`;
				})
			)
		}),
		new winston.transports.File({
			filename: 'logs/proxy.log',
			format: winston.format.json()
		}),
	],
})

// Helper function to create child logger with request ID
export function createRequestLogger(requestId: string) {
	return logger.child({ requestId });
}

export default logger
