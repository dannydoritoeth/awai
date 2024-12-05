class RateLimiter {
    constructor(tokensPerSecond = 10) {
        this.tokensPerSecond = tokensPerSecond;
        this.tokens = tokensPerSecond;
        this.lastRefill = Date.now();
    }

    async waitForToken() {
        this.refillTokens();
        
        if (this.tokens < 1) {
            const waitTime = (1000 / this.tokensPerSecond) * (1 - this.tokens);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.refillTokens();
        }
        
        this.tokens -= 1;
    }

    refillTokens() {
        const now = Date.now();
        const timePassed = now - this.lastRefill;
        this.tokens = Math.min(
            this.tokensPerSecond,
            this.tokens + (timePassed / 1000) * this.tokensPerSecond
        );
        this.lastRefill = now;
    }
}

module.exports = new RateLimiter(); 