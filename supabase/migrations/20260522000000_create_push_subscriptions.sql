-- Create push_subscriptions table
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT user_endpoint_unique UNIQUE(user_id, subscription)
);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own subscriptions"
    ON push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own subscriptions"
    ON push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
    ON push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

-- Optional: Create a database webhook/trigger (We will actually do this via Supabase dashboard or another migration later if needed, but for Edge Function webhooks we can just create the trigger here)
-- We need to call the Edge Function when a message is inserted.
-- Note: Supabase provides a pg_net extension to make HTTP requests from triggers.
-- But using Supabase Webhooks (via dashboard) is standard. I'll create the trigger explicitly using pg_net.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.handle_new_message_push()
RETURNS TRIGGER AS $$
BEGIN
  -- We don't want to block the insert, so we use pg_net.http_post to call the edge function asynchronously.
  -- This requires the edge function URL and ANON key, which we can pass or configure.
  -- For now, relying on Supabase Dashboard Webhooks is safer as it abstracts pg_net auth, 
  -- but we can write a raw pg_net request here.
  -- Let's just create a basic webhook function wrapper
  
  PERFORM net.http_post(
      url := current_setting('app.settings.edge_function_url', true) || '/send-push',
      headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.anon_key', true)
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors to not break message insertion
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_message_insert_send_push
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_message_push();
