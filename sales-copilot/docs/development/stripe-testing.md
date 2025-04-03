# Stripe Integration Testing Guide

This guide provides sample Postman requests for testing the Stripe integration endpoints. Replace `YOUR_SUPABASE_URL` with your actual Supabase URL.

## 1. Create Checkout Session

Creates a Stripe checkout session for a HubSpot portal to start the subscription process.

```http
POST https://YOUR_SUPABASE_URL/functions/v1/hubspot-stripe-create-checkout-session
Content-Type: application/json

Query Parameters:
- portal_id (required): HubSpot portal ID
- plan_tier (optional): 'standard' (default), 'premium', or 'enterprise'
- partner_id (optional): Partner/referrer ID for commission tracking

Example Request:
https://YOUR_SUPABASE_URL/functions/v1/hubspot-stripe-create-checkout-session?portal_id=123456&plan_tier=premium&partner_id=abc123

Response:
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

## 2. Partner Onboarding

Creates a Stripe Connect Express account and generates an onboarding link for partners.

```http
POST https://YOUR_SUPABASE_URL/functions/v1/partner-stripe-onboarding
Content-Type: application/json

Query Parameters:
- partner_id (required): Partner's unique identifier
- email (required): Partner's email address
- name (required): Partner's name

Example Request:
https://YOUR_SUPABASE_URL/functions/v1/partner-stripe-onboarding?partner_id=abc123&email=partner@example.com&name=John%20Doe

Response:
{
  "url": "https://connect.stripe.com/express/...",
  "account_id": "acct_..."
}
```

## 3. Partner Dashboard Access

Generates a link for partners to access their Stripe Express dashboard.

```http
POST https://YOUR_SUPABASE_URL/functions/v1/partner-stripe-dashboard
Content-Type: application/json

Query Parameters:
- partner_id (required): Partner's unique identifier

Example Request:
https://YOUR_SUPABASE_URL/functions/v1/partner-stripe-dashboard?partner_id=abc123

Response:
{
  "url": "https://connect.stripe.com/express/...",
  "status": "active",
  "details_submitted": true,
  "payouts_enabled": true
}
```

## 4. Customer Billing Portal

Generates a link for customers to manage their subscription.

```http
POST https://YOUR_SUPABASE_URL/functions/v1/partner-stripe-billing-portal
Content-Type: application/json

Query Parameters:
- portal_id (required): HubSpot portal ID

Example Request:
https://YOUR_SUPABASE_URL/functions/v1/partner-stripe-billing-portal?portal_id=123456

Response:
{
  "url": "https://billing.stripe.com/..."
}
```

## 5. Stripe Webhook Testing

The webhook endpoint processes Stripe events. For local testing, use the Stripe CLI:

```bash
# Install Stripe CLI and login
stripe login

# Forward webhooks to your local endpoint
stripe listen --forward-to localhost:54321/functions/v1/stripe-payment-webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_succeeded
```

### Important Webhook Events

The webhook handler processes these events:
- `checkout.session.completed`: Creates subscription record
- `customer.subscription.updated`: Updates subscription status
- `customer.subscription.deleted`: Marks subscription as canceled
- `invoice.payment_succeeded`: Updates subscription and creates partner payouts

## Testing Flow Example

1. **Create Partner Account**:
   ```http
   POST /functions/v1/partner-stripe-onboarding?partner_id=abc123&email=partner@example.com&name=John%20Doe
   ```

2. **Create Customer Subscription**:
   ```http
   POST /functions/v1/hubspot-stripe-create-checkout-session?portal_id=123456&plan_tier=premium&partner_id=abc123
   ```

3. **Complete Checkout**: Use the returned URL in a browser

4. **Access Billing Portal**:
   ```http
   POST /functions/v1/partner-stripe-billing-portal?portal_id=123456
   ```

5. **Partner Dashboard Access**:
   ```http
   POST /functions/v1/partner-stripe-dashboard?partner_id=abc123
   ```

## Environment Variables

Ensure these environment variables are set in your Supabase project:
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_URL=https://your-app.com
STRIPE_STANDARD_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...
```

## Testing Tips

1. Use Stripe test mode keys
2. Use Stripe's test card numbers:
   - Success: 4242 4242 4242 4242
   - Requires Authentication: 4000 0025 0000 3155
   - Decline: 4000 0000 0000 9995

3. Monitor webhook events in Stripe Dashboard
4. Check `stripe_events` table for event logs
5. Use Stripe CLI for local webhook testing 