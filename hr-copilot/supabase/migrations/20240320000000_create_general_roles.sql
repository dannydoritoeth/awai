-- Create general_roles table
CREATE TABLE general_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    function_area TEXT NOT NULL,
    classification_level TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE general_roles ADD COLUMN embedding vector(1536);
CREATE INDEX ON general_roles USING ivfflat (embedding vector_cosine_ops);


-- -- Add full text search index
-- ALTER TABLE general_roles ADD COLUMN search_vector tsvector 
--     GENERATED ALWAYS AS (
--         setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
--         setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
--         setweight(to_tsvector('english', coalesce(function_area, '')), 'C')
--     ) STORED;


-- Add RLS policies
ALTER TABLE general_roles ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" 
    ON general_roles FOR SELECT 
    USING (true);

-- Only allow authenticated users to insert/update
CREATE POLICY "Allow authenticated insert" 
    ON general_roles FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update" 
    ON general_roles FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);



-- Create types table for controlled vocabularies
CREATE TABLE general_role_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(type, category)
);

-- Insert initial function areas
INSERT INTO general_role_types (type, category, description)
VALUES 
    ('Policy and Programs', 'function_area', 'Roles focused on policy development and program delivery'),
    ('Corporate Services', 'function_area', 'Roles in HR, Finance, and other corporate functions'),
    ('Digital and Technology', 'function_area', 'IT, digital transformation, and technology roles'),
    ('Service Delivery', 'function_area', 'Customer-facing and service delivery roles'),
    ('Strategy and Planning', 'function_area', 'Strategic planning and organizational development');

-- Insert initial classification levels
INSERT INTO general_role_types (type, category, description)
VALUES 
    ('Entry Level', 'classification_level', 'Early career positions'),
    ('Intermediate', 'classification_level', 'Mid-level positions'),
    ('Senior', 'classification_level', 'Senior individual contributor roles'),
    ('Manager', 'classification_level', 'Management positions'),
    ('Executive', 'classification_level', 'Executive leadership positions'); 