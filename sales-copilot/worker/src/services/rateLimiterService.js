class RateLimiterService {
    constructor() {
        this.requestTimestamps = new Map(); // Track request timestamps by company
    }

    async checkRateLimit(companyId) {
        const now = Date.now();
        const timestamps = this.requestTimestamps.get(companyId) || [];
        
        // Remove timestamps older than 1 second
        const recentTimestamps = timestamps.filter(time => now - time < 1000);
        
        // Professional plan limit is 100 requests per second
        if (recentTimestamps.length >= 80) { // Using 80 to be safe
            const waitTime = 1000 - (now - recentTimestamps[0]);
            if (waitTime > 0) {
                console.log(`Rate limit reached, waiting ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        // Add current timestamp and update list
        recentTimestamps.push(now);
        this.requestTimestamps.set(companyId, recentTimestamps);

        return true;
    }
}

module.exports = new RateLimiterService(); 