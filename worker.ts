import { jwtVerify, SignJWT } from 'jose';
import bcrypt from 'bcryptjs';

const JWT_SECRET_KEY = new TextEncoder().encode('dualnest-secret-key');

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // --- Auth Routes ---
      if (path === '/api/auth/signup' && request.method === 'POST') {
        const { email, password } = await request.json() as any;
        const hashedPassword = await bcrypt.hash(password, 10);
        const id = Math.random().toString(36).substr(2, 9);
        const familyId = id;

        await env.DB.prepare('INSERT INTO users (id, email, password, familyId) VALUES (?, ?, ?, ?)')
          .bind(id, email, hashedPassword, familyId)
          .run();

        const token = await new SignJWT({ id, email, familyId })
          .setProtectedHeader({ alg: 'HS256' })
          .sign(JWT_SECRET_KEY);

        return Response.json({ token, user: { id, email, familyId } }, { headers: corsHeaders });
      }

      if (path === '/api/auth/login' && request.method === 'POST') {
        const { email, password } = await request.json() as any;
        const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?')
          .bind(email)
          .first() as any;

        if (!user || !(await bcrypt.compare(password, user.password))) {
          return Response.json({ error: 'Invalid credentials' }, { status: 401, headers: corsHeaders });
        }

        const token = await new SignJWT({ id: user.id, email: user.email, familyId: user.familyId })
          .setProtectedHeader({ alg: 'HS256' })
          .sign(JWT_SECRET_KEY);

        return Response.json({ token, user: { id: user.id, email: user.email, familyId: user.familyId } }, { headers: corsHeaders });
      }

      // --- Middleware for Protected Routes ---
      const authHeader = request.headers.get('Authorization');
      const token = authHeader?.split(' ')[1];
      if (!token) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

      let payload;
      try {
        const { payload: verifiedPayload } = await jwtVerify(token, JWT_SECRET_KEY);
        payload = verifiedPayload;
      } catch (e) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }
      const userId = payload.id;
      const familyId = payload.familyId;

      // --- Family Sharing ---
      if (path === '/api/family/invite' && request.method === 'POST') {
        const { email } = await request.json() as any;
        const invitedUser = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
          .bind(email)
          .first() as any;

        if (!invitedUser) return Response.json({ error: 'User not found' }, { status: 404, headers: corsHeaders });

        await env.DB.prepare('UPDATE users SET familyId = ? WHERE email = ?')
          .bind(familyId, email)
          .run();

        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // --- Data Routes ---
      if (path === '/api/data' && request.method === 'GET') {
        const { results: locations } = await env.DB.prepare('SELECT * FROM locations WHERE familyId = ?')
          .bind(familyId)
          .all();
        const { results: items } = await env.DB.prepare('SELECT * FROM items WHERE familyId = ?')
          .bind(familyId)
          .all();
        return Response.json({ locations, items }, { headers: corsHeaders });
      }

      if (path === '/api/locations' && request.method === 'POST') {
        const { id, name, image, icon } = await request.json() as any;
        await env.DB.prepare('INSERT OR REPLACE INTO locations (id, familyId, name, image, icon) VALUES (?, ?, ?, ?, ?)')
          .bind(id, familyId, name, image, icon)
          .run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path === '/api/items' && request.method === 'POST') {
        const item = await request.json() as any;
        await env.DB.prepare('INSERT OR REPLACE INTO items (id, familyId, locationId, name, image, category, dateAdded, expiryDate, status, quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(item.id, familyId, item.locationId, item.name, item.image, item.category, item.dateAdded, item.expiryDate, item.status, item.quantity || 1)
          .run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (path.startsWith('/api/items/') && request.method === 'DELETE') {
        const id = path.split('/').pop();
        await env.DB.prepare('DELETE FROM items WHERE id = ? AND familyId = ?')
          .bind(id, familyId)
          .run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
  },
};
