-- Phase 1: Create project-based content system tables

-- 1. Enhance existing ideas table with rich content fields
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS content_body TEXT;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS idea_references JSONB DEFAULT '[]'::jsonb;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 2. Create scripts table
CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  idea_id UUID REFERENCES ideas(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  hook TEXT,
  script_body TEXT,
  cta TEXT,
  editor_notes TEXT,
  reference_attachments JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create projects table (core entity)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL,
  title TEXT NOT NULL,
  idea_id UUID REFERENCES ideas(id) ON DELETE SET NULL,
  script_id UUID REFERENCES scripts(id) ON DELETE SET NULL,
  thumbnail_url TEXT,
  notes TEXT,
  editor_comments TEXT,
  pipeline_stage TEXT DEFAULT 'idea',
  final_asset_id UUID,
  platforms TEXT[] DEFAULT '{}',
  scheduled_time TIMESTAMPTZ,
  published_urls JSONB DEFAULT '{}'::jsonb,
  platform_captions JSONB DEFAULT '{}'::jsonb,
  hashtags TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create project_assets junction table
CREATE TABLE IF NOT EXISTS project_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  is_final_content BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, asset_id)
);

-- 5. Update assets table to support project linking
ALTER TABLE assets ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Enable RLS on new tables
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scripts table
CREATE POLICY "Agency members can view scripts"
ON scripts FOR SELECT
USING (
  client_id IN (
    SELECT c.id FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can create scripts"
ON scripts FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT c.id FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can update scripts"
ON scripts FOR UPDATE
USING (
  client_id IN (
    SELECT c.id FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete scripts"
ON scripts FOR DELETE
USING (
  client_id IN (
    SELECT c.id FROM clients c
    JOIN agency_members am ON c.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- RLS Policies for projects table
CREATE POLICY "Agency members can view projects"
ON projects FOR SELECT
USING (
  agency_id IN (
    SELECT agency_id FROM agency_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can create projects"
ON projects FOR INSERT
WITH CHECK (
  agency_id IN (
    SELECT agency_id FROM agency_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can update projects"
ON projects FOR UPDATE
USING (
  agency_id IN (
    SELECT agency_id FROM agency_members
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete projects"
ON projects FOR DELETE
USING (
  agency_id IN (
    SELECT agency_id FROM agency_members
    WHERE user_id = auth.uid()
  )
);

-- RLS Policies for project_assets table
CREATE POLICY "Agency members can view project assets"
ON project_assets FOR SELECT
USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN agency_members am ON p.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can create project assets"
ON project_assets FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN agency_members am ON p.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can update project assets"
ON project_assets FOR UPDATE
USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN agency_members am ON p.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

CREATE POLICY "Agency members can delete project assets"
ON project_assets FOR DELETE
USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN agency_members am ON p.agency_id = am.agency_id
    WHERE am.user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scripts_client_id ON scripts(client_id);
CREATE INDEX IF NOT EXISTS idx_scripts_idea_id ON scripts(idea_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_agency_id ON projects(agency_id);
CREATE INDEX IF NOT EXISTS idx_projects_pipeline_stage ON projects(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_project_assets_project_id ON project_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assets_asset_id ON project_assets(asset_id);

-- Create updated_at trigger for scripts
CREATE OR REPLACE FUNCTION update_scripts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scripts_timestamp
BEFORE UPDATE ON scripts
FOR EACH ROW
EXECUTE FUNCTION update_scripts_updated_at();

-- Create updated_at trigger for projects
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_timestamp
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_projects_updated_at();