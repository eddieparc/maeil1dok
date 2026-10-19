import { useEffect, useState } from 'react';
import { errorMessage } from './contracts';

type Resource<T> =
  | { readonly status: 'loading'; readonly value?: never; readonly error?: never }
  | { readonly status: 'ready'; readonly value: T; readonly error?: never }
  | { readonly status: 'error'; readonly value?: never; readonly error: string };

// The callback identity is the request key. Consumers memoize it from all
// request inputs; old results disappear in render, before effect cleanup.
export function useTogetherResource<T>(load: () => Promise<T>) {
  const [retry, setRetry] = useState(0);
  const [stored, setStored] = useState<{ load: typeof load; retry: number; result: Resource<T> } | null>(null);
  useEffect(() => {
    let active = true;
    load().then(
      (value) => { if (active) setStored({ load, retry, result: { status: 'ready', value } }); },
      (error: unknown) => { if (active) setStored({ load, retry, result: { status: 'error', error: errorMessage(error) } }); },
    );
    return () => { active = false; };
  }, [load, retry]);
  const result: Resource<T> = stored?.load === load && stored.retry === retry ? stored.result : { status: 'loading' };
  return { ...result, retry: () => setRetry((value) => value + 1) };
}
