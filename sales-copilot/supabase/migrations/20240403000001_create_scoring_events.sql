-- Create scoring_events table
create table if not exists scoring_events (
    id uuid primary key default gen_random_uuid(),
    portal_id text not null,
    event_type text not null default 'score',
    created_at timestamp with time zone default now()
);

-- Add indexes
create index scoring_events_portal_id_idx on scoring_events(portal_id);
create index scoring_events_created_at_idx on scoring_events(created_at);

-- Add RLS policies
alter table scoring_events enable row level security;

-- Allow read access to authenticated users for their own portal
create policy "Users can view their portal's scoring events"
  on scoring_events for select
  using (auth.role() = 'authenticated');

-- Allow insert/update access to service role only
create policy "Service role can manage scoring events"
  on scoring_events for all
  using (auth.role() = 'service_role');

-- Create function to get current period score count
create or replace function get_current_period_score_count(portal_id_param text)
returns table (
    scores_used bigint,
    period_start timestamp with time zone,
    period_end timestamp with time zone,
    max_scores integer
) language plpgsql as $$
declare
    sub record;
begin
    -- Get current subscription period
    select 
        s.current_period_start,
        s.current_period_end,
        s.plan_tier,
        s.status
    into sub
    from subscriptions s
    where s.portal_id = portal_id_param
    and s.status = 'active'
    order by s.created_at desc
    limit 1;

    -- Set max scores based on plan tier
    max_scores := case
        when sub.plan_tier = 'PRO' then 3000
        when sub.plan_tier = 'GROWTH' then 7500
        when sub.plan_tier = 'STARTER' then 750
        else 50  -- FREE tier
    end;

    -- If no active subscription, use rolling 30-day window
    if sub.current_period_start is null then
        period_start := date_trunc('day', now()) - interval '30 days';
        period_end := date_trunc('day', now()) + interval '1 day';
    else
        period_start := sub.current_period_start;
        period_end := sub.current_period_end;
    end if;

    -- Count scores in current period
    select count(*)
    into scores_used
    from scoring_events
    where portal_id = portal_id_param
    and created_at >= period_start
    and created_at < period_end;

    return next;
end;
$$; 