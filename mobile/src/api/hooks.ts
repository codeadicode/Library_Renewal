import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useAuth } from '../auth/AuthContext';
import { policy as seedPolicy } from '../data/seed';
import { Book, LibraryPolicy } from '../domain/types';
import { api } from './index';

/**
 * Catalogue lookups (book by id, topic names, live availability) backed by the
 * backend in API mode. Screens use this instead of reading bundled seed data.
 */
export function useCatalogue() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['catalogue'],
    queryFn: () => api.getCatalogue(),
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const data = query.data;
  const byId = useMemo(() => new Map((data?.books ?? []).map((b) => [b.id, b])), [data]);
  const topicById = useMemo(() => new Map((data?.topics ?? []).map((t) => [t.id, t.name])), [data]);
  const courseById = useMemo(
    () => new Map((data?.courses ?? []).map((c) => [c.id, `${c.code} ${c.name}`])),
    [data],
  );

  const getBook = useCallback((id: string): Book | undefined => byId.get(id), [byId]);
  const topicName = useCallback((id: string) => topicById.get(id) ?? id, [topicById]);
  const courseName = useCallback((id: string) => courseById.get(id) ?? id, [courseById]);
  const availableCount = useCallback((id: string) => data?.availableCounts[id] ?? 0, [data]);

  return {
    books: data?.books ?? [],
    getBook,
    topicName,
    courseName,
    availableCount,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/** Borrowing policy (renewal limit, fine rate, due-soon window) from the backend. */
export function usePolicy(): LibraryPolicy {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['policy'],
    queryFn: () => api.getPolicy(),
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });
  // Until the first response arrives, use the bundled defaults (display-only values).
  return query.data ?? seedPolicy;
}

/** Eligibility and "needs attention" items computed by the backend. */
export function useActionCentre() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['actions', user?.id],
    queryFn: () => api.actionCentre(user!.id),
    enabled: Boolean(user),
  });
}
