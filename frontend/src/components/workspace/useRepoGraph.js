import { useState, useEffect, useCallback } from 'react';
import { getGraphData } from '../../services/api';
import { buildGraphModel } from '../../models/graphModel';
import { mapApiError } from '../../models/apiErrors';

/**
 * Custom hook to load and manage repository graph data with AbortController
 */
export function useRepoGraph(repoId) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rawGraphData, setRawGraphData] = useState(null);
  const [model, setModel] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    if (!repoId) {
      Promise.resolve().then(() => {
        setLoading(false);
        setError({
          title: 'No Repository ID',
          message: 'A valid repository identifier is required.',
          hint: 'Return to the home page to select or analyze a repository.',
          status: 400,
        });
      });
      return;
    }

    const controller = new AbortController();

    Promise.resolve()
      .then(() => {
        setLoading(true);
        setError(null);
        return getGraphData(repoId, { signal: controller.signal });
      })
      .then((data) => {
        if (controller.signal.aborted || !data) return;
        setRawGraphData(data);
        const indexedModel = buildGraphModel(data);
        setModel(indexedModel);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === 'CanceledError' || err?.isCanceled) {
          return;
        }
        const mapped = mapApiError(err);
        setError(mapped);
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [repoId, reloadTrigger]);

  const reload = useCallback(() => {
    setReloadTrigger((c) => c + 1);
  }, []);

  return {
    loading,
    error,
    graphData: rawGraphData,
    model,
    reload,
  };
}
