'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function TrackRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const id = params?.id;
    if (id) {
      router.replace(`/branch/${id}`);
    } else {
      router.replace('/');
    }
  }, [params, router]);

  return (
    <div className="pt-12 text-center text-xs font-mono text-zinc-400">
      Redirecting to branch...
    </div>
  );
}

