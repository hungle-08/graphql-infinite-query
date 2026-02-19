import { Button } from './ui/button';
import { Input } from './ui/input';
import { type DocumentNode } from 'graphql';
import {
  type ApolloClient,
  type OperationVariables,
  type QueryHookOptions,
  type TypedDocumentNode,
} from '@apollo/client';
import { useInfiniteLoadQuery } from '../lib/useInfiniteLoadQuery';
import { useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { type Pagination } from '../lib/type';
import { checkHasBottomReached } from '../lib/checkHasBottomReached';

export type InfiniteSelectProps<Query, QueryVariables, TData> = {
  /**
   * The GraphQL query document to execute.
   * Accepts a plain `DocumentNode` or a fully-typed `TypedDocumentNode`.
   */
  query: DocumentNode | TypedDocumentNode<Query, QueryVariables>;

  /**
   * Factory that builds the query variables from the current pagination state
   * and the optional search string.
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
  variables?: (pagination: Pagination, search?: string | null) => QueryVariables;

  /**
   * Derives a stable React key from each item.
   * **Required** — without this, all object items produce the same key
   * (`"[object Object]"`), breaking list reconciliation.
   *
   * @example
   * ```tsx
   * getKey={item => item.id}
   * ```
   */
  getKey: (item: TData) => string | number;

  /**
   * Renders the visible content of a single list item inside the dropdown.
   *
   * @example
   * ```tsx
   * renderItem={user => <span>{user.name}</span>}
   * ```
   */
  renderItem: (item: TData) => React.ReactNode;

  /**
   * Called when the user selects an item from the dropdown.
   * Receives the full `TData` item that was clicked.
   */
  onChange?: (item: TData) => void;

  /**
   * The Apollo Client instance to use for the query.
   * Required — pass a specific client when working in a multi-client setup.
   */
  clientInstance: ApolloClient<object>;

  /**
   * When `true`, the input and dropdown are non-interactive.
   *
   * @default false
   */
  disabled?: boolean;

  /**
   * Text shown in the dropdown when the query returns an empty list.
   *
   * @default 'No Data'
   */
  emptyText?: string;

  /**
   * Placeholder text displayed inside the search input.
   *
   * @default undefined
   */
  placeholder?: string;

  /**
   * Distance in pixels from the bottom of the dropdown list at which the
   * next page is fetched. Increase this to load the next page earlier.
   * Passed directly to `checkHasBottomReached`.
   *
   * @default 30
   */
  bottomOffset?: number;

  /**
   * When `true`, the query is not executed.
   * Useful for conditional fetching (e.g. waiting for a required parent value).
   * Forwarded to `useInfiniteLoadQuery`.
   *
   * @default false
   */
  skip?: boolean;

  /**
   * Controls how Apollo reads from and writes to the cache.
   * Forwarded to `useInfiniteLoadQuery`.
   *
   * @default 'cache-first'
   */
  fetchPolicy?: QueryHookOptions['fetchPolicy'];

  /**
   * Override the starting pagination when the hook first mounts.
   * Forwarded to `useInfiniteLoadQuery`.
   *
   * @default { pageNumber: 1, pageSize: 10 }
   */
  defaultPagination?: Pagination;

  /**
   * Debounce delay in milliseconds applied to the search input.
   * Forwarded to `useInfiniteLoadQuery`.
   *
   * @default 500
   */
  debounceTime?: number;
};

export function InfiniteSelect<
  TData,
  TQuery extends object = object,
  TQueryVariables extends OperationVariables = OperationVariables,
>({
  query,
  variables,
  getKey,
  renderItem,
  onChange,
  clientInstance,
  disabled,
  emptyText = 'No Data',
  placeholder,
  bottomOffset,
  skip,
  fetchPolicy,
  defaultPagination,
  debounceTime,
}: InfiniteSelectProps<TQuery, TQueryVariables, TData>) {
  const [open, setOpen] = useState(false);

  const { data, loading, loadNextPage, onSearch } = useInfiniteLoadQuery<
    TQuery,
    TQueryVariables,
    TData
  >({
    query,
    variables,
    clientInstance,
    skip,
    fetchPolicy,
    defaultPagination,
    debounceTime,
  });

  const handleSelect = (item: TData) => {
    setOpen(false);
    onChange?.(item);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (checkHasBottomReached(event, bottomOffset)) {
      loadNextPage();
    }
  };

  return (
    <div className="w-full">
      <div className="relative">
        <div>
          <SearchIcon className="absolute left-2 top-2 text-muted-foreground p-1" />
          <Input
            disabled={disabled}
            placeholder={placeholder}
            onClick={() => setOpen(true)}
            className="w-full pl-8"
            onChange={e => onSearch(e.target.value)}
            onBlur={handleCancel}
          />
        </div>

        {open && (
          <div
            onScroll={handleScroll}
            className="w-full h-[350px] overflow-auto rounded-md shadow-sm border mt-2 absolute z-[100] bg-white"
          >
            {data.map(item => (
              <Button
                key={getKey(item)}
                variant="ghost"
                className="w-full flex justify-start"
                onMouseDown={e => {
                  e.preventDefault();
                  handleSelect(item);
                }}
              >
                {renderItem(item)}
              </Button>
            ))}

            {data.length === 0 && !loading && (
              <div className="w-full h-full flex items-center justify-center">
                {emptyText}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
