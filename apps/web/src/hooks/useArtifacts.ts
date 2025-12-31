import { useState, useEffect, useRef } from 'react';
import { getArtifacts } from '../api';
import type { Artifact } from '../types';

interface UseArtifactsResult {
  artifacts: Artifact[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

const POLL_INTERVAL = 3000; // 3 seconds

/**
 * Hook for fetching and polling artifacts for a task
 */
export function useArtifacts(taskId: string | undefined): UseArtifactsResult {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<number | null>(null);

  const fetchArtifactsData = async (id: string, isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }

    try {
      const data = await getArtifacts(id);
      setArtifacts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch artifacts'));
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  const refetch = () => {
    if (taskId) {
      fetchArtifactsData(taskId, true);
    }
  };

  useEffect(() => {
    if (!taskId) {
      setArtifacts([]);
      setError(null);
      return;
    }

    // Initial fetch
    fetchArtifactsData(taskId, true);

    // Poll for updates
    intervalRef.current = window.setInterval(() => {
      fetchArtifactsData(taskId, false);
    }, POLL_INTERVAL);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [taskId]);

  return { artifacts, loading, error, refetch };
}
