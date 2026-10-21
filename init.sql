-- 1. Create the elections table
CREATE TYPE election_status AS ENUM ('Waiting', 'Started', 'Ended');
CREATE TABLE IF NOT EXISTS elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    max_votes INTEGER NOT NULL DEFAULT 5,
    status election_status NOT NULL DEFAULT 'Waiting'
);

-- 2. Create the candidates table
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL
);

-- 3. Create the voter hashes table (the manually generated codes)
CREATE TABLE IF NOT EXISTS voter_hashes (
    hashcode TEXT PRIMARY KEY,
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE
);

-- 4. Create the votes table
CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    hashcode TEXT NOT NULL REFERENCES voter_hashes(hashcode) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    signature TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_vote UNIQUE (hashcode, candidate_id)
);

CREATE TABLE IF NOT EXISTS voters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    allowed BOOLEAN NOT NULL DEFAULT FALSE,
    
    UNIQUE(telegram_id, election_id)
);

-- 6. Table for available roles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    panel_url VARCHAR(255) NOT NULL
);

-- 7. Table for admins (passwords will be hashed, so length is 255)
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Junction table linking admins to their roles
CREATE TABLE IF NOT EXISTS admin_roles (
    admin_id INTEGER REFERENCES admins(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (admin_id, role_id)
);

INSERT INTO roles (name, panel_url) VALUES ('Manager', '/Manager_Panel'), ('HR', '/HR_Panel') ON CONFLICT DO NOTHING;

CREATE INDEX idx_candidates_election ON candidates(election_id);
CREATE INDEX idx_voter_hashes_election ON voter_hashes(election_id);
CREATE INDEX idx_votes_candidate ON votes(candidate_id);

CREATE OR REPLACE FUNCTION enforce_max_votes()
RETURNS TRIGGER AS $$
DECLARE
    v_max_votes INTEGER;
    v_current_votes INTEGER;
BEGIN
    SELECT e.max_votes INTO v_max_votes
    FROM voter_hashes vh
    JOIN elections e ON vh.election_id = e.id
    WHERE vh.hashcode = NEW.hashcode;

    SELECT COUNT(*) INTO v_current_votes
    FROM votes
    WHERE hashcode = NEW.hashcode;

    IF v_current_votes >= v_max_votes THEN
        RAISE EXCEPTION 'Hashcode % has exceeded the maximum allowed votes (%)', NEW.hashcode, v_max_votes;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_max_votes
BEFORE INSERT ON votes
FOR EACH ROW
EXECUTE FUNCTION enforce_max_votes();




INSERT INTO admins (username, password) 
VALUES 
    ('manager', '$2b$12$DDXQGp1Ivj2AEyAp0Z1Yqug4uMzQAZoC7Duiv/OKEcrmDdsGPgOYu'),
    ('hr', '$2b$12$DDXQGp1Ivj2AEyAp0Z1Yqug4uMzQAZoC7Duiv/OKEcrmDdsGPgOYu')
ON CONFLICT (username) DO NOTHING;

INSERT INTO admin_roles (admin_id, role_id)
SELECT a.id, r.id 
FROM admins a, roles r 
WHERE a.username = 'manager' AND r.name = 'Manager'
ON CONFLICT DO NOTHING;

INSERT INTO admin_roles (admin_id, role_id)
SELECT a.id, r.id 
FROM admins a, roles r 
WHERE a.username = 'hr' AND r.name = 'HR'
ON CONFLICT DO NOTHING;