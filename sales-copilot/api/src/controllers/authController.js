const integrationService = require('../services/integrationService');
const customerService = require('../services/customerService');

class AuthController {
    async initiateOAuth(req, res) {
        try {
            const { integration } = req.params;
            const { customerId } = req.query;

            if (!customerId) {
                return res.status(400).json({ error: 'Customer ID is required' });
            }

            const authUrl = await integrationService.getAuthUrl(integration, customerId);
            res.json({ authUrl });
        } catch (error) {
            console.error('OAuth initiation error:', error);
            res.status(500).json({ error: 'Failed to initiate OAuth flow' });
        }
    }

    async handleOAuthCallback(req, res) {
        try {
            const { integration } = req.params;
            const { code, state } = req.query;

            // state parameter should contain the customerId (encrypted)
            const customerId = await integrationService.validateAndDecodeState(state);
            
            // Exchange code for access token and save credentials
            await integrationService.handleOAuthCallback(integration, code, customerId);

            // Redirect to success page or show success message
            res.redirect(`${process.env.FRONTEND_URL}/integration-success`);
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect(`${process.env.FRONTEND_URL}/integration-error`);
        }
    }
}

module.exports = new AuthController(); 