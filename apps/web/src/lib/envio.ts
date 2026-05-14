/**
 * Shared Envio HyperIndex GraphQL client utility.
 *
 * Reads the endpoint from NEXT_PUBLIC_ENVIO_GRAPHQL_URL at runtime.
 * Falls back to the local dev default (127.0.0.1:8080) if unset.
 *
 * Usage:
 *   import { envioFetch } from "@/lib/envio";
 *   const data = await envioFetch<{ Job: Job[] }>(QUERY);
 */

const ENVIO_URL =
  process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL ?? "https://indexer.dev.hyperindex.xyz/001fb92/v1/graphql";

/**
 * Execute a GraphQL query against the Envio HyperIndex endpoint.
 * Returns the `data` field of the response, or throws on network/GraphQL error.
 */
export async function envioFetch<T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(ENVIO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Envio GraphQL HTTP error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { data?: T; errors?: unknown[] };

  if (json.errors && json.errors.length > 0) {
    throw new Error(`Envio GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  return json.data as T;
}

/** Convenience wrapper that returns null instead of throwing — for server components. */
export async function envioFetchSafe<T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T | null> {
  try {
    return await envioFetch<T>(query, variables);
  } catch (err) {
    console.error("[envio] fetch failed:", err);
    return null;
  }
}
