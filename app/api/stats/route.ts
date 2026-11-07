import { NextResponse } from 'next/server';

// In-memory counter cache with baseline metrics
let inMemoryStats = {
  resumesStored: 51,
  vaultsActive: 14,
};

export async function GET() {
  try {
    // If Upstash Redis or Vercel KV environment variables are present, read live keys
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    if (redisUrl && redisToken) {
      const res = await fetch(`${redisUrl}/mget/storr:resumes_stored/storr:vaults_active`, {
        headers: { Authorization: `Bearer ${redisToken}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const stored = parseInt(data.result?.[0] || '0', 10);
        const vaults = parseInt(data.result?.[1] || '0', 10);
        return NextResponse.json({
          resumesStored: stored > 0 ? stored : inMemoryStats.resumesStored,
          vaultsActive: vaults > 0 ? vaults : inMemoryStats.vaultsActive,
        });
      }
    }

    return NextResponse.json(inMemoryStats);
  } catch {
    return NextResponse.json(inMemoryStats);
  }
}

export async function POST(req: Request) {
  try {
    const { action } = await req.json();

    if (action === 'resume_committed') {
      inMemoryStats.resumesStored += 1;
    } else if (action === 'vault_connected') {
      inMemoryStats.vaultsActive += 1;
    }

    // Persist to Upstash / Vercel KV if configured
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    if (redisUrl && redisToken && action) {
      const key = action === 'resume_committed' ? 'storr:resumes_stored' : 'storr:vaults_active';
      await fetch(`${redisUrl}/incr/${key}`, {
        headers: { Authorization: `Bearer ${redisToken}` },
      });
    }

    return NextResponse.json({ ok: true, stats: inMemoryStats });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

