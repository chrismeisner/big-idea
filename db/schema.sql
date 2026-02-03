-- db/schema.sql
-- PostgreSQL schema for Big Idea app

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) UNIQUE NOT NULL,
  mobile VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255),
  today_time VARCHAR(10) DEFAULT '16:20',
  goals TEXT DEFAULT '',
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Ideas table
CREATE TABLE IF NOT EXISTS ideas (
  id SERIAL PRIMARY KEY,
  idea_id VARCHAR(50) UNIQUE NOT NULL,
  idea_title VARCHAR(255) NOT NULL,
  idea_summary TEXT DEFAULT '',
  user_mobile VARCHAR(20),
  user_id VARCHAR(50) NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Milestones table
CREATE TABLE IF NOT EXISTS milestones (
  id SERIAL PRIMARY KEY,
  milestone_id VARCHAR(50) UNIQUE NOT NULL,
  milestone_name VARCHAR(255) NOT NULL,
  milestone_time TIMESTAMP,
  milestone_notes TEXT DEFAULT '',
  user_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(50) UNIQUE NOT NULL,
  task_name VARCHAR(255) NOT NULL,
  task_note TEXT DEFAULT '',
  idea_id VARCHAR(50),
  user_id VARCHAR(50) NOT NULL,
  parent_task VARCHAR(50) DEFAULT '',
  milestone_id VARCHAR(50) DEFAULT '',
  "order" INTEGER DEFAULT 0,
  sub_order INTEGER DEFAULT 0,
  order_today INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  completed_time TIMESTAMP,
  focus VARCHAR(20) DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ideas_user_id ON ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_idea_id ON tasks(idea_id);
CREATE INDEX IF NOT EXISTS idx_tasks_focus ON tasks(focus);
CREATE INDEX IF NOT EXISTS idx_milestones_user_id ON milestones(user_id);
