CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password TEXT,
  familyId TEXT
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  familyId TEXT,
  name TEXT,
  image TEXT,
  icon TEXT
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  familyId TEXT,
  locationId TEXT,
  name TEXT,
  image TEXT,
  category TEXT,
  dateAdded TEXT,
  expiryDate TEXT,
  status TEXT,
  quantity INTEGER DEFAULT 1
);
