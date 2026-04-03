import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dualnest-secret-key';

// Database setup
const db = new sqlite3.Database('dualnest.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    familyId TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    familyId TEXT,
    name TEXT,
    image TEXT,
    icon TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS items (
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
  )`);
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- Auth Routes ---

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const id = Math.random().toString(36).substr(2, 9);
  const familyId = id; // Default familyId is the user's first ID

  db.run('INSERT INTO users (id, email, password, familyId) VALUES (?, ?, ?, ?)', [id, email, hashedPassword, familyId], (err) => {
    if (err) return res.status(400).json({ error: 'Email already exists' });
    const token = jwt.sign({ id, email, familyId }, JWT_SECRET);
    res.json({ token, user: { id, email, familyId } });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user: any) => {
    if (err || !user) return res.status(400).json({ error: 'User not found' });
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user.id, email: user.email, familyId: user.familyId }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, familyId: user.familyId } });
  });
});

// --- Family Sharing Route ---

app.post('/api/family/invite', authenticateToken, (req: any, res) => {
  const { email } = req.body;
  const familyId = req.user.familyId;

  db.get('SELECT id FROM users WHERE email = ?', [email], (err, user: any) => {
    if (err || !user) return res.status(404).json({ error: 'User not found. Ask them to sign up first!' });

    db.run('UPDATE users SET familyId = ? WHERE email = ?', [familyId, email], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: `Added ${email} to your family!` });
    });
  });
});

// --- Data Routes ---

app.get('/api/data', authenticateToken, (req: any, res) => {
  const familyId = req.user.familyId;
  
  db.all('SELECT * FROM locations WHERE familyId = ?', [familyId], (err, locations) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.all('SELECT * FROM items WHERE familyId = ?', [familyId], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ locations, items });
    });
  });
});

app.post('/api/locations', authenticateToken, (req: any, res) => {
  const { id, name, image, icon } = req.body;
  const familyId = req.user.familyId;
  
  db.run('INSERT OR REPLACE INTO locations (id, familyId, name, image, icon) VALUES (?, ?, ?, ?, ?)', 
    [id, familyId, name, image, icon], 
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.post('/api/items', authenticateToken, (req: any, res) => {
  const { id, locationId, name, image, category, dateAdded, expiryDate, status, quantity } = req.body;
  const familyId = req.user.familyId;
  
  db.run('INSERT OR REPLACE INTO items (id, familyId, locationId, name, image, category, dateAdded, expiryDate, status, quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
    [id, familyId, locationId, name, image, category, dateAdded, expiryDate, status, quantity || 1], 
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.delete('/api/items/:id', authenticateToken, (req: any, res) => {
  const familyId = req.user.familyId;
  db.run('DELETE FROM items WHERE id = ? AND familyId = ?', [req.params.id, familyId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- Vite Middleware ---

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
