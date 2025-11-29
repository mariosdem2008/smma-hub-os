-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add index for faster queries
CREATE INDEX idx_tasks_client_id ON public.tasks(client_id);
CREATE INDEX idx_tasks_agency_id ON public.tasks(agency_id);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Agency members can view tasks for their clients
CREATE POLICY "Agency members can view tasks"
ON public.tasks FOR SELECT
USING (
  agency_id IN (
    SELECT agency_id FROM public.agency_members 
    WHERE user_id = auth.uid()
  )
);

-- Agency members can create tasks for their clients
CREATE POLICY "Agency members can create tasks"
ON public.tasks FOR INSERT
WITH CHECK (
  agency_id IN (
    SELECT agency_id FROM public.agency_members 
    WHERE user_id = auth.uid()
  )
);

-- Agency members can update tasks for their clients
CREATE POLICY "Agency members can update tasks"
ON public.tasks FOR UPDATE
USING (
  agency_id IN (
    SELECT agency_id FROM public.agency_members 
    WHERE user_id = auth.uid()
  )
);

-- Agency members can delete tasks for their clients
CREATE POLICY "Agency members can delete tasks"
ON public.tasks FOR DELETE
USING (
  agency_id IN (
    SELECT agency_id FROM public.agency_members 
    WHERE user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();