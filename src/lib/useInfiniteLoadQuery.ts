import {
  type QueryHookOptions,
  useQuery,
  type DefaultContext,
  type DocumentNode,
  type OperationVariables,
  type TypedDocumentNode,
  type ApolloClient,
  type ApolloError,
  NetworkStatus,
} from '@apollo/client';
import { debounce, type DebouncedFunc } from 'lodash-es';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Pagination, type PaginationResponse } from './type';

const DEFAULT_DEBOUNCE_TIME = 500;
const DEFAULT_PAGINATION: Pagination = { pageNumber: 1, pageSize: 10 };
const EMPTY_PAGINATION: PaginationResponse = {
  pageNumber: 0,
  pageSize: 0,
  total: 0,
  totalPage: 0,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type UseInfiniteLoadQueryProps<TQuery, TVariables, TData> = {
  /**
   * The GraphQL query document to execute.
   *
   * @example
   * ```ts
   * const GET_USERS = gql`
   *   query GetUsers($pagination: PaginationInput, $filter: String) {
   *     getUsers(pagination: $pagination, filter: $filter) {
   *       pagination { pageNumber pageSize total totalPage }
   *       items { id name }
   *     }
   *   }
   * `;
   * ```
   */
  query: DocumentNode | TypedDocumentNode<TQuery, TVariables>;

  /**
   * Extracts the list of items from the raw query response.
   *
   * @example
   * ```ts
   * getItems={data => data.getUsers.items}
   * getItems={data => data.users.edges.map(e => e.node)}
   * ```
   */
  getItems: (data: TQuery) => TData[];

  /**
   * Extracts pagination metadata from the raw query response.
   *
   * @example
   * ```ts
   * getPagination={data => data.getUsers.pagination}
   * ```
   */
  getPagination: (data: TQuery) => PaginationResponse;

  /**
   * Merges the previous page items with the incoming next-page items.
   * Defaults to a simple append — override to apply deduplication or custom ordering.
   *
   * @default (existing, incoming) => [...existing, ...incoming]
   *
   * @example
   * ```ts
   * Custom merge logic
   * mergeItems={(existing, incoming) => {
   *   const ids = new Set(existing.map(i => i.id));
   *   return [...existing, ...incoming.filter(i => !ids.has(i.id))];
   * }}
   * ```
   */
  mergeItems?: (existing: TData[], incoming: TData[]) => TData[];

  /**
   * Factory that builds query variables from the current pagination state
   * and optional search string.
   *
   * @example
   * ```ts
   * variables={(pagination, search) => ({ pagination, filter: { name: search } })}
   * ```
   */
  variables?: (pagination: Pagination, search?: string | null) => TVariables;

  /** Apollo Client instance. Required for multi-client setups. */
  clientInstance: ApolloClient<object>;

  /**
   * When `true`, the query is not executed.
   * @default false
   */
  skip?: boolean;

  /** Apollo context forwarded to every query/fetchMore call (e.g. auth headers). */
  context?: DefaultContext;

  /**
   * Controls Apollo cache read/write strategy.
   * @default 'cache-first'
   */
  fetchPolicy?: QueryHookOptions['fetchPolicy'];

  /**
   * Initial pagination. Also the reset target when `reset()` is called.
   * @default { pageNumber: 1, pageSize: 10 }
   */
  defaultPagination?: Pagination;

  /**
   * Debounce delay in ms for `onSearch`.
   * @default 500
   */
  debounceTime?: number;
};

// ---------------------------------------------------------------------------
// Return value
// ---------------------------------------------------------------------------

export type UseInfiniteLoadQueryResult<TData> = {
  /** Accumulated flat list of items across all pages loaded so far. */
  data: TData[];

  /** Apollo error from the most recent failed request, or `undefined`. */
  error: ApolloError | undefined;

  /**
   * `true` while either the initial query
   */
  isFetching: boolean;

  /**
   * `true` only while a next-page fetchMore request is in flight.
   * Useful for a bottom-of-list "loading more" spinner.
   */
  isFetchingNextPage: boolean;

  /**
   * Debounced search handler. Resets to page 1 after `debounceTime` elapses.
   */
  onSearch: DebouncedFunc<(value: string) => void>;

  /**
   * Non-debounced version of `onSearch`. Useful for programmatic searches.
   */
  onSearchImmediate: (value: string) => void;

  /** The currently active search string (`null` before the first search). */
  searchValue: string | null;

  /** Pagination metadata from the most recent successful response. */
  pagination: PaginationResponse;

  /** `true` when there is at least one more page to fetch. */
  hasNextPage: boolean;

  /**
   * Fetches the next page and appends items to `data`.
   * No-op when already loading or `!hasNextPage`.
   */
  loadNextPage: () => void;

  /**
   * Cancels any pending debounced search, clears the search string,
   * and re-fetches from page 1.
   */
  reset: () => void;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInfiniteLoadQuery<
  TQuery extends object,
  TVariables extends OperationVariables = OperationVariables,
  TData = unknown,
>({
  query,
  getItems,
  getPagination,
  mergeItems = (existing, incoming) => [...existing, ...incoming],
  variables,
  context,
  skip,
  clientInstance,
  fetchPolicy = 'cache-first',
  defaultPagination = DEFAULT_PAGINATION,
  debounceTime: debounceDelay = DEFAULT_DEBOUNCE_TIME,
}: UseInfiniteLoadQueryProps<TQuery, TVariables, TData>): UseInfiniteLoadQueryResult<TData> {
  const [searchValue, setSearchValue] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Variables builder — stable reference, only recreated when `variables` changes
  // ---------------------------------------------------------------------------
  const buildVariables = useCallback(
    (pagination: Pagination, search: string | null) =>
      variables
        ? variables(pagination, search)
        : ({ pagination, filter: search } as unknown as TVariables),
    [variables],
  );

  // ---------------------------------------------------------------------------
  // Core Apollo query
  // ---------------------------------------------------------------------------
  const {
    data,
    error,
    loading: isFetching,
    fetchMore,
    networkStatus,
  } = useQuery<TQuery>(query, {
    client: clientInstance,
    fetchPolicy,
    context,
    variables: buildVariables(defaultPagination, searchValue),
    skip,
    notifyOnNetworkStatusChange: true,
  });

  // ---------------------------------------------------------------------------
  // Derived state — no extra useState needed; everything comes from Apollo cache
  // ---------------------------------------------------------------------------
  const isFetchingNextPage = networkStatus === NetworkStatus.fetchMore;

  const items = data ? getItems(data) : [];
  const pagination = data ? getPagination(data) : EMPTY_PAGINATION;
  const hasNextPage = pagination.pageNumber < pagination.totalPage;

  // ---------------------------------------------------------------------------
  // Load next page via fetchMore — Apollo handles cache merge
  // ---------------------------------------------------------------------------
  const loadNextPage = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || isFetching) return;

    fetchMore({
      variables: buildVariables(
        { pageSize: pagination.pageSize, pageNumber: pagination.pageNumber + 1 },
        searchValue,
      ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateQuery: ((prev: any, { fetchMoreResult }: { fetchMoreResult?: any }) => {
        if (!fetchMoreResult) return prev;

        const prevItems = getItems(prev as TQuery);
        const nextItems = getItems(fetchMoreResult as TQuery);
        const nextPagination = getPagination(fetchMoreResult as TQuery);

        const merged = mergeItems(prevItems, nextItems);

        return patchQueryResult(prev, fetchMoreResult, merged, nextPagination);
      }) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });
  }, [hasNextPage, isFetchingNextPage, isFetching, fetchMore, buildVariables, pagination.pageSize, pagination.pageNumber, searchValue, getItems, getPagination, mergeItems]);

  // ---------------------------------------------------------------------------
  // Search handlers
  // ---------------------------------------------------------------------------
  const onSearchImmediate = useCallback(
    (value: string) => {
      setSearchValue(value.trim() || null);
    },
    [],
  );

  // Stable debounced function — recreated only when delay or immediate handler changes
  const onSearch = useMemo(
    () => debounce(onSearchImmediate, debounceDelay),
    [onSearchImmediate, debounceDelay],
  );

  // Cleanup on unmount or when a new debounced fn is created
  useEffect(() => () => onSearch.cancel(), [onSearch]);

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------
  const reset = useCallback(() => {
    onSearch.cancel();
    setSearchValue(null);
    // searchValue → null causes buildVariables to rebuild → Apollo re-fetches
  }, [onSearch]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------
  return {
    data: items,
    error,
    isFetchingNextPage,
    isFetching,
    onSearch,
    onSearchImmediate,
    searchValue,
    pagination,
    hasNextPage,
    loadNextPage,
    reset,
  };
}

function patchQueryResult<TQuery extends object, TData>(
  prev: TQuery,
  next: TQuery,
  mergedItems: TData[],
  nextPagination: PaginationResponse,
): TQuery {
  // Find the single query field name (safe: Apollo always returns exactly one
  // field per operation at the root level, __typename is not enumerable here).
  const key = Object.keys(next)[0] as keyof TQuery;

  return {
    ...next,
    [key]: {
      ...(next[key] as object),
      items: mergedItems,
      pagination: nextPagination,
    },
  };
}