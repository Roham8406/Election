-- 1. Create the elections table
CREATE TABLE IF NOT EXISTS elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    max_votes INTEGER NOT NULL DEFAULT 5,
);

-- 2. Create the candidates table
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
);

-- 3. Create the voter hashes table (the manually generated codes)
CREATE TABLE IF NOT EXISTS voter_hashes (
    hashcode VARCHAR(100) PRIMARY KEY,
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
);

-- 4. Create the votes table
CREATE TABLE IF NOT EXISTS votes (
    hashcode VARCHAR(100) NOT NULL REFERENCES voter_hashes(hashcode) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (hashcode, candidate_id)
);

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