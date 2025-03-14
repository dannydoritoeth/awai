export class Logger {
  private context: string;

  constructor(context: string = 'default') {
    this.context = context;
  }

  info(message: string, data?: any) {
    console.log(JSON.stringify({
      level: 'info',
      context: this.context,
      message,
      data,
      timestamp: new Date().toISOString()
    }));
  }

  error(message: string, error?: any) {
    console.error(JSON.stringify({
      level: 'error',
      context: this.context,
      message,
      error: error?.message || error,
      stack: error?.stack,
      timestamp: new Date().toISOString()
    }));
  }
}

export const logger = new Logger(); 