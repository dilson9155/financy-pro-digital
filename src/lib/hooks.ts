"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./client";

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook de consulta a API. Refaz a busca quando a URL (filtros) muda.
 */
export function useApiQuery<T>(url: string | null) {
  const [state, setState] = useState<State<T>>({
    data: null,
    loading: Boolean(url),
    error: null,
  });

  const load = useCallback(async () => {
    if (!url) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.get<T>(url);
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : "Erro ao carregar.",
      });
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}
