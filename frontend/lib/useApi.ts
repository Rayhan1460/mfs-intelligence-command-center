"use client";

import { useEffect, useState } from "react";

import { apiFetch, friendlyError } from "@/lib/api";

type ResourceState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export type Resource<T> = ResourceState<T> & { retry: () => void };

export function useApi<T>(path: string | null): Resource<T> {
  const [attempt, setAttempt] = useState(0);
  const [resource, setResource] = useState<ResourceState<T>>({ status: "loading", data: null, error: null });

  useEffect(() => {
    let active = true;
    if (!path) {
      setResource({ status: "loading", data: null, error: null });
      return () => { active = false; };
    }
    setResource({ status: "loading", data: null, error: null });
    apiFetch<T>(path)
      .then((data) => { if (active) setResource({ status: "success", data, error: null }); })
      .catch((error: unknown) => { if (active) setResource({ status: "error", data: null, error: friendlyError(error) }); });
    return () => { active = false; };
  }, [path, attempt]);

  return { ...resource, retry: () => setAttempt((value) => value + 1) };
}