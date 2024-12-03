const axios = require('axios');

class PipedriveAuth {
    constructor() {
        this.clientId = process.env.PIPEDRIVE_CLIENT_ID;
        this.clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET;
        this.redirectUri = process.env.PIPEDRIVE_REDIRECT_URI;
    }

    getAuthUrl(state) {
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            state: state,
            scope: 'deals:read' // Add other required scopes
        });

        return `https://oauth.pipedrive.com/oauth/authorize?${params.toString()}`;
    }

    async exchangeCodeForToken(code) {
        try {
            const response = await axios.post('https://oauth.pipedrive.com/oauth/token', {
                grant_type: 'authorization_code',
                code,
                redirect_uri: this.redirectUri,
                client_id: this.clientId,
                client_secret: this.clientSecret
            });

            const { access_token, refresh_token } = response.data;

            // Get company domain
            const userInfo = await this.getUserInfo(access_token);

            return {
                access_token,
                refresh_token,
                company_domain: userInfo.company_domain
            };
        } catch (error) {
            console.error('Token exchange error:', error);
            throw new Error('Failed to exchange code for token');
        }
    }

    async getUserInfo(accessToken) {
        const response = await axios.get('https://api.pipedrive.com/v1/users/me', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        return response.data.data;
    }
}

module.exports = new PipedriveAuth(); 