import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000,
        // Don't retry deterministic client errors (4xx). tRPC NOT_FOUND /
        // FORBIDDEN / UNAUTHORIZED / BAD_REQUEST will never succeed on retry,
        // and the default 3-retry backoff makes invalid-id pages stall ~85ms
        // showing skeleton state before the real error UI renders. Server
        // errors (5xx) and network failures still get the default 3 retries.
        retry: (failureCount, error) => {
          const httpStatus = (error as { data?: { httpStatus?: number } })?.data?.httpStatus;
          if (httpStatus && httpStatus >= 400 && httpStatus < 500) return false;
          return failureCount < 3;
        },
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });
