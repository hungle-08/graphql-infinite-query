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
import { debounce, type DebouncedFunc, get } from 'lodash-es';
import { useEffect, useState } from 'react';
import { type Pagination, type PaginationResponse } from './type';

const DEFAULT_DEBOUNCE_TIME = 500;
const DEFAULT_PAGINATION: Pagination = {
  pageNumber: 1,
  pageSize: 10,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type UseInfiniteLoadQueryProps<TQuery, TVariables> = {
  /**
   * The GraphQL query document to execute.
   * Accepts a plain `DocumentNode` or a fully-typed `TypedDocumentNode`.
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
   * Factory that builds the query variables from the current pagination state
   * and the optional search string. Called on every page load and search change.
   *
   * If omitted, the hook forwards `{ pagination, filter: search }` by default.
   *
   * @example
   * ```ts
   * variables={(pagination, search) => ({
   *   pagination,
   *   filter: { name: search },
   * })}
   * ```
   */
  variables?: (pagination: Pagination, search?: string | null) => TVariables;

  /**
   * The Apollo Client instance to use for this query.
   * Required — pass a specific client when working in a multi-client setup.
   */
  clientInstance: ApolloClient<object>;

  /**
   * When `true`, the query is not executed.
   * Useful for conditional fetching (e.g. waiting for a required parent value).
   *
   * @default false
   */
  skip?: boolean;

  /**
   * Apollo context forwarded to every query and fetchMore call.
   * Commonly used to attach custom headers or authentication tokens.
   *
   * @see https://www.apollographql.com/docs/react/data/queries/#context
   */
  context?: DefaultContext;

  /**
   * Controls how Apollo reads from and writes to the cache.
   *
   * @default 'cache-first'
   * @see https://www.apollographql.com/docs/react/data/queries/#setting-a-fetch-policy
   */
  fetchPolicy?: QueryHookOptions['fetchPolicy'];

  /**
   * Override the initial pagination applied when the hook first mounts.
   * Also used as the reset target when `reset()` is called.
   *
   * @default { pageNumber: 1, pageSize: 10 }
   */
  defaultPagination?: Pagination;

  /**
   * Debounce delay in milliseconds applied to the `onSearch` handler.
   * Reduces unnecessary network requests while the user is still typing.
   *
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
   * `true` while either the initial query or a `fetchMore` (next-page) request
   * is in flight. Use this to show a unified loading indicator.
   */
  loading: boolean;

  /**
   * `true` only while a next-page (`fetchMore`) request is in flight.
   * Useful for showing a "loading more" spinner at the bottom of the list
   * without masking already-rendered items.
   */
  isFetchingMore: boolean;

  /**
   * Debounced search handler. Triggers a new query (from page 1) after the
   * configured `debounceTime` has elapsed since the last call.
   * Safe to pass directly to an `onChange` input handler.
   */
  onSearch: DebouncedFunc<(value: string) => void>;

  /**
   * Non-debounced version of `onSearch`.
   * Triggers the search immediately — useful for programmatic searches or
   * when the caller already manages debouncing externally.
   */
  onSearchImmediate: (value: string) => void;

  /** The currently active search string (`null` before the first search). */
  searchValue: string | null;

  /** Pagination metadata returned by the most recent successful response. */
  pagination: PaginationResponse;

  /**
   * `true` when there is at least one more page available to fetch.
   * Use this to decide whether to render a "Load more" button or trigger
   * `loadNextPage` on scroll.
   */
  hasNextPage: boolean;

  /**
   * Fetches the next page and appends its items to `data`.
   * No-op when already loading or when on the last page (`!hasNextPage`).
   */
  loadNextPage: () => void;

  /**
   * Cancels any pending debounced search, clears the search string, and
   * re-fetches from the first page using `defaultPagination`.
   */
  reset: () => void;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInfiniteLoadQuery<
  TQuery extends object,
  TVariables extends OperationVariables,
  TData,
>({
  query,
  variables,
  context,
  skip,
  clientInstance,
  fetchPolicy = 'cache-first',
  defaultPagination = DEFAULT_PAGINATION,
  debounceTime = DEFAULT_DEBOUNCE_TIME,
}: UseInfiniteLoadQueryProps<TQuery, TVariables>): UseInfiniteLoadQueryResult<TData> {
  const [searchValue, setSearchValue] = useState<string | null>(null);

  const getVariables = (pagination: Pagination, search: string | null) =>
    variables
      ? { ...variables(pagination, search) }
      : { pagination, filter: search };

  const getData = (
    data?: TQuery,
  ): { pagination: PaginationResponse; items: TData[] } => {
    if (!data) {
      return {
        pagination: { pageNumber: 0, pageSize: 0, totalPage: 0, total: 0 },
        items: [],
      };
    }

    const [queryName] = Object.keys(data);
    const { pagination, items } = get(data, queryName as string);
    return { pagination, items };
  };

  const {
    data,
    error,
    refetch,
    loading: isInitialLoading,
    fetchMore,
    networkStatus,
  } = useQuery<TQuery>(query, {
    client: clientInstance,
    fetchPolicy,
    context,
    variables: getVariables(defaultPagination, searchValue),
    skip,
    notifyOnNetworkStatusChange: true,
  });

  const isFetchingMore = networkStatus === NetworkStatus.fetchMore;
  const loading = isInitialLoading || isFetchingMore;

  const loadNextPage = () => {
    const { pagination } = getData(data);
    if (pagination.pageNumber >= pagination.totalPage || loading) {
      return;
    }

    fetchMore({
      variables: getVariables(
        {
          pageSize: pagination.pageSize,
          pageNumber: pagination.pageNumber + 1,
        },
        searchValue,
      ),
      // Apollo v3.11+ wraps updateQuery's parameter/return in unresolvable
      // conditional types (ContainsFragmentsRefs, UnwrapFragmentRefs, etc.)
      // that TypeScript cannot satisfy while TQuery is still a type parameter.
      // Record<string, any> accurately reflects the dynamic-key access pattern.
      /* eslint-disable @typescript-eslint/no-explicit-any */
      updateQuery: ((
        previousResult: Record<string, any>,
        { fetchMoreResult }: { fetchMoreResult?: Record<string, any> },
      ) => {
        if (!fetchMoreResult) {
          return previousResult;
        }

        const [queryName] = Object.keys(previousResult);
        const prev = get(previousResult, queryName);
        const next = get(fetchMoreResult, queryName);

        return {
          ...previousResult,
          [queryName]: {
            ...next,
            items: [...prev.items, ...next.items],
          },
        };
      }) as any,
      /* eslint-enable @typescript-eslint/no-explicit-any */
    });
  };

  const onSearch = debounce((value: string) => {
    setSearchValue(value.trim());
  }, debounceTime);

  const onSearchImmediate = (value: string) => {
    setSearchValue(value.trim());
  };

  const reset = () => {
    onSearch.cancel();
    setSearchValue('');
    refetch(getVariables(defaultPagination, ''));
  };

  useEffect(() => () => onSearch.cancel(), [onSearch]);

  const { pagination, items } = getData(data);

  return {
    data: items,
    error,
    loading,
    isFetchingMore,
    onSearch,
    onSearchImmediate,
    searchValue,
    pagination,
    hasNextPage: pagination.pageNumber < pagination.totalPage,
    loadNextPage,
    reset,
  };
}
