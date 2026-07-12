import { Redis } from '@upstash/redis';

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const isAllowedOrigin = !origin || origin.startsWith('http://localhost') || origin.endsWith('.vercel.app') || origin.endsWith('.shotlister.app') || origin.includes('shotlister');
  const allowedCors = isAllowedOrigin && origin ? origin : 'https://shotlister.vercel.app';

  res.setHeader('Access-Control-Allow-Origin', allowedCors);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Dynamically resolve the environment variables to handle Vercel database prefixing/binding aliases
  let url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  let token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    const urlKey = Object.keys(process.env).find(k => k.endsWith('KV_REST_API_URL') || k.endsWith('UPSTASH_REDIS_REST_URL'));
    const tokenKey = Object.keys(process.env).find(k => k.endsWith('KV_REST_API_TOKEN') || k.endsWith('UPSTASH_REDIS_REST_TOKEN'));
    
    if (urlKey) url = process.env[urlKey];
    if (tokenKey) token = process.env[tokenKey];
  }

  // Ensure database credentials are set
  if (!url || !token) {
    return res.status(500).json({ 
      error: 'Database environment variables not configured on Vercel',
      availableKeys: Object.keys(process.env).filter(k => k.includes('REDIS') || k.includes('KV') || k.includes('UPSTASH'))
    });
  }

  const { passcode, action, payload } = req.body || {};

  // Payload size check (approximate 5MB limit, though Vercel drops at 4.5MB anyway)
  if (JSON.stringify(req.body || {}).length > 5 * 1024 * 1024) {
    return res.status(413).json({ error: 'Payload too large (Max 5MB)' });
  }

  if (!passcode || typeof passcode !== 'string' || passcode.length > 100) {
    return res.status(400).json({ error: 'Invalid passcode format' });
  }

  try {
    const redis = new Redis({ url, token });
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
      if (!projectId || typeof projectId !== 'string' || projectId.length > 50) {
        return res.status(400).json({ error: 'Invalid projectId' });
      }
      const data = await redis.get(`sl:user:${passcode}:project:${projectId}`);
      return res.status(200).json(data || null);
    }

    if (action === 'save_project') {
      const { projectId, shots } = payload || {};
      if (!projectId || typeof projectId !== 'string' || projectId.length > 50) {
        return res.status(400).json({ error: 'Invalid projectId' });
      }
      await redis.set(`sl:user:${passcode}:project:${projectId}`, shots);
      return res.status(200).json({ success: true });
    }

    if (action === 'get_image') {
      const { imageId } = payload || {};
      if (!imageId || typeof imageId !== 'string' || imageId.length > 50) {
        return res.status(400).json({ error: 'Invalid imageId' });
      }
      const data = await redis.get(`sl:user:${passcode}:image:${imageId}`);
      return res.status(200).json(data || null);
    }

    if (action === 'save_image') {
      const { imageId, dataUrl } = payload || {};
      if (!imageId || typeof imageId !== 'string' || imageId.length > 50) {
        return res.status(400).json({ error: 'Invalid imageId' });
      }
      await redis.set(`sl:user:${passcode}:image:${imageId}`, dataUrl);
      return res.status(200).json({ success: true });
    }

    if (action === 'delete_project') {
      const { projectId } = payload || {};
      if (!projectId || typeof projectId !== 'string' || projectId.length > 50) {
        return res.status(400).json({ error: 'Invalid projectId' });
      }
      await redis.del(`sl:user:${passcode}:project:${projectId}`);
      return res.status(200).json({ success: true });
    }

    // Publish a read-only snapshot of a project under a separate view-only passcode
    if (action === 'publish_view') {
      const { projectId, viewPasscode, shots, projectMeta } = payload || {};
      if (!projectId || typeof projectId !== 'string' || projectId.length > 50) {
        return res.status(400).json({ error: 'Invalid projectId' });
      }
      if (!viewPasscode || typeof viewPasscode !== 'string' || viewPasscode.length > 200) {
        return res.status(400).json({ error: 'Invalid viewPasscode' });
      }
      if (!shots || !Array.isArray(shots)) {
        return res.status(400).json({ error: 'Invalid shots payload' });
      }
      // Store the shots under the view-only passcode namespace
      await redis.set(`sl:user:${viewPasscode}:project:${projectId}`, shots);
      // Store a minimal project list so the view user sees the project on home
      const viewList = [{ ...(projectMeta || {}), id: projectId }];
      await redis.set(`sl:user:${viewPasscode}:projects`, viewList);
      // Mark this passcode as view-only so the app can detect it on login
      await redis.set(`sl:viewonly:${viewPasscode}`, '1');
      return res.status(200).json({ success: true });
    }

    // Check if a passcode is view-only
    if (action === 'check_viewonly') {
      const flag = await redis.get(`sl:viewonly:${passcode}`);
      return res.status(200).json({ isViewOnly: flag === '1' });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    console.error('API sync error:', err);
    return res.status(500).json({ error: err.message });
  }
}
