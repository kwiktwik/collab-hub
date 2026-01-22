'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function OrgPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  useEffect(() => {
    // Redirect to members page as the default org page
    router.replace(`/org/${slug}/members`);
  }, [slug, router]);

  return (
    <div className="loading-page">
      <div className="spinner" />
    </div>
  );
}
