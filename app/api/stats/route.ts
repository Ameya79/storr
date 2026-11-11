import { NextResponse } from 'next/server';

// Real event counters (in-memory fallback when KV / Upstash is not configured)
const realStats = {
  resumesStored: 0,
  vaultsActive: 0,
};

// Lightweight rate limiting: max 30 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 30) {
    return false;
  }
  entry.count += 1;
  return true;
}

export async function GET() {
  try {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    if (redisUrl && redisToken) {
      const res = await fetch(`${redisUrl}/mget/stor:resumes_stored/stor:vaults_active`, {
        headers: { Authorization: `Bearer ${redisToken}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const stored = parseInt(data.result?.[0] || '0', 10);
        const vaults = parseInt(data.result?.[1] || '0', 10);
        return NextResponse.json({
          resumesStored: stored > 0 ? stored : 0,
          vaultsActive: vaults > 0 ? vaults : 0,
        });
      }
    }

    return NextResponse.json(realStats);
  } catch {
    return NextResponse.json(realStats);
  }
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
    }

    const { action } = body;
    if (action !== 'resume_committed' && action !== 'vault_connected') {
      return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
    }

    if (action === 'resume_committed') {
      realStats.resumesStored += 1;
    } else if (action === 'vault_connected') {
      realStats.vaultsActive += 1;
    }

    // Persist to Upstash / Vercel KV if configured
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    if (redisUrl && redisToken && action) {
      const key = action === 'resume_committed' ? 'stor:resumes_stored' : 'stor:vaults_active';
      await fetch(`${redisUrl}/incr/${key}`, {
        headers: { Authorization: `Bearer ${redisToken}` },
      });
    }

    return NextResponse.json({ ok: true, stats: realStats });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
