import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  /** Replace data locally (optimistic updates). */
  setData: Dispatch<SetStateAction<T | null>>;
}

/** Run an async loader on mount and expose its result plus a reload function. */
export function useAsync<T>(loader: () => Promise<T>): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setData(await loader());
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []); // loader is expected to be a stable function (e.g. from `api`)

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}
