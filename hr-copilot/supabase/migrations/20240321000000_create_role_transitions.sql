-- Create transition types table
CREATE TABLE transition_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Insert common transition types
INSERT INTO transition_types (name, description) VALUES
    ('Promotion', 'Moving to a higher grade or level within the same career path'),
    ('Lateral Move', 'Moving to a similar level in a different area or department'),
    ('Career Change', 'Significant change in role type or career direction'),
    ('Acting Role', 'Temporary assignment to a different role'),
    ('Secondment', 'Temporary transfer to another department or organization'),
    ('Development Role', 'Role focused on developing new skills or capabilities');

-- Create transition requirements table
CREATE TABLE transition_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    requirement_type TEXT NOT NULL, -- 'skill', 'capability', 'qualification', 'experience'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create role transitions table
CREATE TABLE role_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_role_id UUID REFERENCES roles(id),
    to_role_id UUID REFERENCES roles(id),
    transition_type_id UUID REFERENCES transition_types(id),
    frequency INTEGER, -- How often this transition occurs (for suggesting common paths)
    success_rate FLOAT, -- Historical success rate of this transition
    avg_time_months INTEGER, -- Average time taken for this transition
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create transition requirements mapping
CREATE TABLE role_transition_requirements (
    transition_id UUID REFERENCES role_transitions(id),
    requirement_id UUID REFERENCES transition_requirements(id),
    required_level TEXT, -- e.g., 'Basic', 'Intermediate', 'Advanced'
    is_mandatory BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    PRIMARY KEY (transition_id, requirement_id)
);

-- Create transition history table
CREATE TABLE transition_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    person_id UUID NOT NULL, -- Reference to the person making the transition
    from_role_id UUID REFERENCES roles(id),
    to_role_id UUID REFERENCES roles(id),
    transition_type_id UUID REFERENCES transition_types(id),
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL, -- 'planned', 'in_progress', 'completed', 'cancelled'
    success_rating INTEGER, -- 1-5 rating of how successful the transition was
    feedback TEXT, -- Feedback on the transition process
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for better query performance
CREATE INDEX idx_role_transitions_from_role ON role_transitions(from_role_id);
CREATE INDEX idx_role_transitions_to_role ON role_transitions(to_role_id);
CREATE INDEX idx_role_transitions_type ON role_transitions(transition_type_id);
CREATE INDEX idx_transition_history_person ON transition_history(person_id);
CREATE INDEX idx_transition_history_status ON transition_history(status);
CREATE INDEX idx_transition_history_dates ON transition_history(start_date, end_date);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_transition_types_updated_at
    BEFORE UPDATE ON transition_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transition_requirements_updated_at
    BEFORE UPDATE ON transition_requirements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_role_transitions_updated_at
    BEFORE UPDATE ON role_transitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transition_history_updated_at
    BEFORE UPDATE ON transition_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE transition_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE transition_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_transition_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE transition_history ENABLE ROW LEVEL SECURITY;

-- Everyone can read transition types and requirements
CREATE POLICY "Anyone can read transition types"
    ON transition_types FOR SELECT
    USING (true);

CREATE POLICY "Anyone can read transition requirements"
    ON transition_requirements FOR SELECT
    USING (true);

CREATE POLICY "Anyone can read role transitions"
    ON role_transitions FOR SELECT
    USING (true);

CREATE POLICY "Anyone can read role transition requirements"
    ON role_transition_requirements FOR SELECT
    USING (true);

-- Only authenticated users can read their own transition history
CREATE POLICY "Users can read their own transition history"
    ON transition_history FOR SELECT
    USING (auth.uid() = person_id);

-- Only authorized roles can modify data
CREATE POLICY "Only authorized roles can modify transition types"
    ON transition_types FOR ALL
    USING (auth.jwt() ->> 'role' IN ('admin', 'hr'));

CREATE POLICY "Only authorized roles can modify transition requirements"
    ON transition_requirements FOR ALL
    USING (auth.jwt() ->> 'role' IN ('admin', 'hr'));

CREATE POLICY "Only authorized roles can modify role transitions"
    ON role_transitions FOR ALL
    USING (auth.jwt() ->> 'role' IN ('admin', 'hr'));

CREATE POLICY "Only authorized roles can modify role transition requirements"
    ON role_transition_requirements FOR ALL
    USING (auth.jwt() ->> 'role' IN ('admin', 'hr'));

CREATE POLICY "Only authorized roles can modify transition history"
    ON transition_history FOR ALL
    USING (auth.jwt() ->> 'role' IN ('admin', 'hr')); 