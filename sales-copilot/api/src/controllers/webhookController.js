const eventProcessor = require('../services/eventProcessor');

class WebhookController {
    async handlePipedriveWebhook(req, res) {
        try {
            const { event, data } = req.body;
            
            // Validate webhook signature if available
            // this.validateWebhookSignature(req);

            await eventProcessor.processEvent('pipedrive', event, data);
            
            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Webhook processing error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = new WebhookController(); 