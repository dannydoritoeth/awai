-- Enable UUID generation
create extension if not exists "pgcrypto";

-- customers table to support multiple CMS platforms
create table if not exists customers (
    id uuid primary key default gen_random_uuid(),
    platform text not null, -- e.g., 'hubspot', 'shopify', 'webflow'
    platform_customer_id text not null, -- ID from the platform (e.g., portal ID, store ID)
    stripe_customer_id text unique,
    email text,
    name text,
    metadata jsonb default '{}',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    unique(platform, platform_customer_id)
);

-- partners table (for referrers/affiliates)
create table if not exists partners (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text,
    stripe_account_id text unique,
    commission_rate numeric default 0.40,
    status text default 'pending' check (status in ('pending', 'active', 'inactive')),
    onboarding_completed boolean default false,
    payout_schedule text default 'monthly' check (payout_schedule in ('weekly', 'monthly')),
    metadata jsonb default '{}',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- subscriptions table
create table if not exists subscriptions (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid references customers(id),
    partner_id uuid references partners(id),
    stripe_subscription_id text unique,
    status text not null check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')),
    plan_tier text not null,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    cancel_at timestamp with time zone,
    canceled_at timestamp with time zone,
    trial_start timestamp with time zone,
    trial_end timestamp with time zone,
    metadata jsonb default '{}',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- partner_payouts table
create table if not exists partner_payouts (
    id uuid primary key default gen_random_uuid(),
    partner_id uuid references partners(id),
    stripe_transfer_id text unique,
    amount numeric not null,
    currency text default 'usd',
    status text not null check (status in ('pending', 'paid', 'failed')),
    payout_period_start timestamp with time zone,
    payout_period_end timestamp with time zone,
    metadata jsonb default '{}',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- subscription_items table (for tracking quantity-based subscriptions)
create table if not exists subscription_items (
    id uuid primary key default gen_random_uuid(),
    subscription_id uuid references subscriptions(id),
    stripe_subscription_item_id text unique,
    stripe_price_id text not null,
    quantity integer default 1,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- stripe_events table for webhook event logging
create table if not exists stripe_events (
    id uuid primary key default gen_random_uuid(),
    event_type text not null,
    stripe_event_id text unique,
    api_version text,
    raw_payload jsonb not null,
    processed boolean default false,
    error text,
    created_at timestamp with time zone default now()
);

-- Create indexes for better query performance
create index if not exists idx_customers_stripe_customer_id on customers(stripe_customer_id);
create index if not exists idx_partners_stripe_account_id on partners(stripe_account_id);
create index if not exists idx_subscriptions_stripe_subscription_id on subscriptions(stripe_subscription_id);
create index if not exists idx_subscriptions_customer_id on subscriptions(customer_id);
create index if not exists idx_subscriptions_partner_id on subscriptions(partner_id);
create index if not exists idx_stripe_events_event_type on stripe_events(event_type);
create index if not exists idx_stripe_events_created_at on stripe_events(created_at);

-- Add triggers to automatically update updated_at timestamps
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_customers_updated_at
    before update on customers
    for each row
    execute function update_updated_at_column();

create trigger update_partners_updated_at
    before update on partners
    for each row
    execute function update_updated_at_column();

create trigger update_subscriptions_updated_at
    before update on subscriptions
    for each row
    execute function update_updated_at_column();

create trigger update_subscription_items_updated_at
    before update on subscription_items
    for each row
    execute function update_updated_at_column(); 