-- Approval_tasks already removed, just ensure 'approved' stage exists in enum
-- Note: The approval stage already exists in the pipeline_stage enum
-- We'll use: approval → scheduled (on approve) or approval → editing (on request changes)

-- Verify enum values
DO $$ 
BEGIN
    -- Check if 'approval' stage exists (it should)
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'approval' 
        AND enumtypid = 'pipeline_stage'::regtype
    ) THEN
        RAISE EXCEPTION 'approval stage missing from pipeline_stage enum';
    END IF;
END $$;