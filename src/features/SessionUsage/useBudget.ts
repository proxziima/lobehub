'use client';

import useSWR, { mutate } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

export const BUDGET_SWR_KEY = 'sessionBilling.getBudget';

export const mutateBudget = () => mutate(BUDGET_SWR_KEY);

export const useBudget = () => {
  return useSWR(BUDGET_SWR_KEY, () => lambdaClient.subscription.getBudget.query(), {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });
};
