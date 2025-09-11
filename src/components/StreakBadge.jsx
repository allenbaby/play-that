// components/StreakBadge.jsx
'use client';

import useSWRImmutable from 'swr/immutable';

const fetcher = (url) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('failed');
    return r.json();
  });

export default function StreakBadge() {
  const { data } = useSWRImmutable('/api/streak', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
    dedupingInterval: 60_000, // dev StrictMode safety
  });

  if (!data) return null;
  return <div>🔥 {data.current} day streak (best {data.longest})</div>;
}
