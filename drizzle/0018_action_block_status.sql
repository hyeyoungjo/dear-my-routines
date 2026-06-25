CREATE TYPE action_block_status AS ENUM ('done', 'partial');
ALTER TABLE action_blocks ADD COLUMN status action_block_status NOT NULL DEFAULT 'done';
