import winston from "winston"

const myformat = winston.format.printf(({level, message, label, timestamp}) => {
	return `${timestamp} ${level}: ${message}`;
});

const logger = winston.createLogger({
	level: 'debug',
	format: winston.format.combine(winston.format.timestamp(), myformat),
	transports: [
		new winston.transports.Console(),
		new winston.transports.File({ filename: 'console.log' })
	]
});

export default logger;
