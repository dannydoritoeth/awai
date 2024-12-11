const { LOG_LEVELS } = require('./langchainPineconeService');

class Logger {
    constructor(logLevel = LOG_LEVELS.INFO) {
        this.logLevel = logLevel;
    }

    info(message, data = null) {
        this.log(LOG_LEVELS.INFO, message, data);
    }

    error(message, data = null) {
        this.log(LOG_LEVELS.ERROR, message, data);
    }

    debug(message, data = null) {
        this.log(LOG_LEVELS.DEBUG, message, data);
    }

    log(level, message, data = null) {
        if (level <= this.logLevel) {
            switch (level) {
                case LOG_LEVELS.ERROR:
                    console.error(message, data || '');
                    break;
                case LOG_LEVELS.INFO:
                    console.log(message, data ? `(${JSON.stringify(data)})` : '');
                    break;
                case LOG_LEVELS.DEBUG:
                    console.log('DEBUG:', message, data || '');
                    break;
            }
        }
    }
}

module.exports = Logger; 