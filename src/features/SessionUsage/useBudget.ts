'use client';

import { useEffect } from 'react';
import useSWR, { mutate } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

export const BUDGET_SWR_KEY = 'sessionBilling.getBudget';

export const mutateBudget = () => mutate(BUDGET_SWR_KEY);

export const useBudget = () => {
  const swr = useSWR(BUDGET_SWR_KEY, () => lambdaClient.subscription.getBudget.query(), {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  const sessionResetsAt = swr.data?.session.resetsAt;

  // Schedule a targeted revalidation exactly when the session window expires.
  // Clamped to < 1 hour to avoid browser timer throttling on long durations.
  // The 30s poll handles the weekly reset (days away).
  useEffect(() => {
    if (!sessionResetsAt) return;
    const delay = new Date(sessionResetsAt).getTime() - Date.now();
    if (delay <= 0 || delay > 60 * 60 * 1000) return;
    const id = setTimeout(mutateBudget, delay);
    return () => clearTimeout(id);
  }, [sessionResetsAt]);

  return swr;
};
