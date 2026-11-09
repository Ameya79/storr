'use client';

import React from 'react';
import { ProfileLinksBar } from '@/components/ProfileLinksBar';
import { ApplicationsPipeline } from '@/components/ApplicationsPipeline';

export default function ApplicationsPage() {
  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* Permanent Career Profile Links Bar */}
      <ProfileLinksBar />

      {/* Main Applications Pipeline */}
      <ApplicationsPipeline />
    </div>
  );
}
