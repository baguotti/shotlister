import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  // Handle CORS options request
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Ensure database credentials are set
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ error: 'Database environment variables not configured on Vercel' });
  }

  const { passcode, action, payload } = req.body || {};

  if (!passcode) {
    return res.status(400).json({ error: 'Passcode is required' });
  }

  try {
    const redis = Redis.fromEnv();
    const listKey = `sl:user:${passcode}:projects`;

    if (action === 'get_list') {
      const data = await redis.get(listKey);
      return res.status(200).json(data || []);
    }

    if (action === 'save_list') {
      await redis.set(listKey, payload);
      return res.status(200).json({ success: true });
    }

    if (action === 'get_project') {
      const { projectId } = payload || {};
      if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
      }
      const data = await redis.get(`sl:user:${passcode}:project:${projectId}`);
      return res.status(200).json(data || null);
    }

    if (action === 'save_project') {
      const { projectId, shots } = payload || {};
      if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
      }
      await redis.set(`sl:user:${passcode}:project:${projectId}`, shots);
      return res.status(200).json({ success: true });
    }

    if (action === 'delete_project') {
      const { projectId } = payload || {};
      if (!projectId) {
        return res.status(400).json({ error: 'projectId is required' });
      }
      await redis.del(`sl:user:${passcode}:project:${projectId}`);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    console.error('API sync error:', err);
    return res.status(500).json({ error: err.message });
  }
}
