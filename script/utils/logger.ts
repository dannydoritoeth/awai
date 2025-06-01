interface LogMetadata {
    [key: string]: any;
}

class Logger {
    private logToConsole(level: string, message: string, metadata?: LogMetadata) {
        const timestamp = new Date().toISOString();
        const metadataStr = metadata ? JSON.stringify(metadata) : '';
        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message} ${metadataStr}`);
    }

    info(message: string, metadata?: LogMetadata) {
        this.logToConsole('info', message, metadata);
    }

    error(message: string, metadata?: LogMetadata) {
        this.logToConsole('error', message, metadata);
    }

    warn(message: string, metadata?: LogMetadata) {
        this.logToConsole('warn', message, metadata);
    }

    debug(message: string, metadata?: LogMetadata) {
        if (process.env.DEBUG) {
            this.logToConsole('debug', message, metadata);
        }
    }
}

export const logger = new Logger(); 