
-- 1. Create a table for user profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  recovery_email TEXT,
  fingerprint_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read their own profile
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Policy to allow users to update their own profile
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policy to allow insertion during signup
CREATE POLICY "Public profiles are insertable by owners" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Create a table for vehicles
CREATE TABLE vehicles (
  id TEXT PRIMARY KEY,
  plate TEXT NOT NULL,
  registration_time TIMESTAMPTZ NOT NULL,
  entry_time TIMESTAMPTZ NOT NULL,
  status_changed_at TIMESTAMPTZ NOT NULL,
  exit_time TIMESTAMPTZ,
  model TEXT NOT NULL,
  customer TEXT NOT NULL,
  prisma_number INTEGER NOT NULL,
  prisma_color TEXT NOT NULL,
  consultant TEXT NOT NULL,
  service TEXT NOT NULL,
  wash_status TEXT NOT NULL,
  delivery_status TEXT NOT NULL,
  slot_index INTEGER NOT NULL,
  yard_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on vehicles
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write vehicles (adjust as needed for multi-tenant)
CREATE POLICY "Allow all actions for authenticated users" ON vehicles
  FOR ALL USING (auth.role() = 'authenticated');

-- 3. Create a table for logs
CREATE TABLE logs (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  vehicle_plate TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  prisma_number INTEGER,
  prisma_color TEXT,
  action TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  details TEXT NOT NULL,
  duration TEXT,
  idle_reason TEXT,
  idle_actions TEXT,
  yard_id TEXT NOT NULL,
  yard_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on logs
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write logs
CREATE POLICY "Allow all actions for authenticated users" ON logs
  FOR ALL USING (auth.role() = 'authenticated');
