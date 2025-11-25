-- Enable realtime for assets table to support approval notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.assets;