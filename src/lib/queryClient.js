import { QueryClient } from "@tanstack/react-query";

const isNonRetryableQueryError = (error) => {
  const status = Number(error?.status || 0);
  if (status >= 400 && status < 500) return true;

  const message = String(error?.message || "").toLowerCase();
  if (!message) return false;

  return (
    message.includes("does not exist") ||
    message.includes("not found") ||
    message.includes("permission denied") ||
    message.includes("not authorized") ||
    message.includes("jwt") ||
    message.includes("invalid input") ||
    message.includes("failed to parse")
  );
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (isNonRetryableQueryError(error)) return false;
        return failureCount < 1;
      },
    },
  },
});
