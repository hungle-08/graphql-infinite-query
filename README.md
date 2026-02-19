# graphql-infinite-query

A React hook and drop-in select component for GraphQL infinite scroll / pagination with Apollo Client.

- **Zero boilerplate** — one hook call handles fetching, merging, and searching
- **Works with any response shape** — extract items and pagination with simple getter functions
- **Built-in debounced search** — with an immediate variant for programmatic use
- **Smart cache integration** — uses Apollo `fetchMore` + `updateQuery` so the cache stays consistent
- **Custom merge logic** — deduplicate or reorder incoming pages however you like
- **Full TypeScript support** — all generics flow from query → item type automatically

## Installation

```bash
npm install graphql-infinite-query
```

### Peer dependencies

```bash
npm install react react-dom @apollo/client graphql
```

## Exports

| Export | Type | Description |
|---|---|---|
| `useInfiniteLoadQuery` | Hook | Core hook — fetches pages, merges results, handles search |
| `InfiniteSelect` | Component | Ready-made searchable dropdown with infinite scroll |
| `checkHasBottomReached` | Utility | Detects scroll-to-bottom inside an `onScroll` handler |
| `Pagination` | Type | `{ pageNumber, pageSize }` |
| `PaginationResponse` | Type | `{ pageNumber, pageSize, total, totalPage }` |

---

## `useInfiniteLoadQuery`

The hook is agnostic about your API shape. You tell it how to extract items and pagination via two getter functions, and it handles everything else.

### Expected GraphQL response shape

```graphql
{
  anyQueryName {
    pagination { pageNumber pageSize total totalPage }
    items { ... }
  }
}
```

### Basic usage

```tsx
import { useInfiniteLoadQuery, checkHasBottomReached } from 'graphql-infinite-query';
import { gql } from '@apollo/client';

const GET_USERS = gql`
  query GetUsers($pagination: PaginationInput, $filter: String) {
    getUsers(pagination: $pagination, filter: $filter) {
      pagination { pageNumber pageSize total totalPage }
      items { id name email }
    }
  }
`;

function UserList({ client }) {
  const {
    data,           // TData[] — accumulated items across all loaded pages
    loading,        // true while any request is in flight
    isFetchingMore, // true only during a next-page fetch (great for spinners)
    hasNextPage,
    loadNextPage,
    onSearch,       // debounced — wire directly to an input onChange
    reset,
    error,
  } = useInfiniteLoadQuery({
    query: GET_USERS,
    clientInstance: client,
    getItems: (data) => data.getUsers.items,
    getPagination: (data) => data.getUsers.pagination,
    variables: (pagination, search) => ({
      pagination,
      filter: search,
    }),
  });

  return (
    <div onScroll={e => { if (checkHasBottomReached(e)) loadNextPage(); }}>
      <input onChange={e => onSearch(e.target.value)} placeholder="Search..." />

      {data.map(user => <div key={user.id}>{user.name}</div>)}

      {isFetchingMore && <span>Loading more…</span>}
      {!hasNextPage && <span>All loaded</span>}
      {error && <span>Error: {error.message}</span>}
    </div>
  );
}
```

### Custom merge — deduplication example

By default incoming items are appended. Pass `mergeItems` to override:

```tsx
useInfiniteLoadQuery({
  // ...
  mergeItems: (existing, incoming) => {
    const seen = new Set(existing.map(i => i.id));
    return [...existing, ...incoming.filter(i => !seen.has(i.id))];
  },
});
```

### Programmatic search (no debounce)

```tsx
const { onSearchImmediate } = useInfiniteLoadQuery({ ... });

// Call immediately — useful for controlled inputs or external triggers
onSearchImmediate('John');
```

### Props

| Prop | Type | Default | Required | Description |
|---|---|---|---|---|
| `query` | `DocumentNode` | — | Yes | GraphQL query document |
| `clientInstance` | `ApolloClient` | — | Yes | Apollo Client instance |
| `getItems` | `(data: TQuery) => TData[]` | — | Yes | Extract the item array from the query response |
| `getPagination` | `(data: TQuery) => PaginationResponse` | — | Yes | Extract pagination metadata from the query response |
| `variables` | `(pagination, search?) => TVariables` | `{ pagination, filter: search }` | No | Factory that builds query variables per page/search |
| `mergeItems` | `(existing, incoming) => TData[]` | append | No | Custom strategy for merging pages (e.g. deduplication) |
| `skip` | `boolean` | `false` | No | Skip query execution |
| `fetchPolicy` | `string` | `'cache-first'` | No | Apollo fetch policy |
| `defaultPagination` | `Pagination` | `{ pageNumber: 1, pageSize: 10 }` | No | Initial pagination — also the reset target |
| `debounceTime` | `number` | `500` | No | Debounce delay in ms for `onSearch` |
| `context` | `DefaultContext` | — | No | Apollo context forwarded to every request (e.g. auth headers) |

### Returns

| Value | Type | Description |
|---|---|---|
| `data` | `TData[]` | Accumulated flat list of items across all pages loaded so far |
| `loading` | `boolean` | `true` while the initial query **or** a fetchMore is in flight |
| `isFetchingMore` | `boolean` | `true` only during a next-page fetch — ideal for a bottom spinner |
| `hasNextPage` | `boolean` | `true` when there is at least one more page to fetch |
| `loadNextPage` | `() => void` | Fetches and appends the next page; no-op when loading or no next page |
| `onSearch` | `DebouncedFunc<(value: string) => void>` | Debounced search — resets to page 1 after `debounceTime` ms |
| `onSearchImmediate` | `(value: string) => void` | Non-debounced version of `onSearch` |
| `searchValue` | `string \| null` | Currently active search string (`null` before the first search) |
| `pagination` | `PaginationResponse` | Pagination metadata from the most recent successful response |
| `reset` | `() => void` | Cancels pending debounce, clears search, and refetches from page 1 |
| `error` | `ApolloError \| undefined` | Error from the most recent failed request |

---

## `InfiniteSelect`

A ready-made searchable dropdown that wires `useInfiniteLoadQuery` to an input and a scrollable list. No extra state needed on your end.

```tsx
import { InfiniteSelect } from 'graphql-infinite-query';

<InfiniteSelect
  query={GET_USERS}
  clientInstance={client}
  getItems={(data) => data.getUsers.items}
  getPagination={(data) => data.getUsers.pagination}
  variables={(pagination, search) => ({ pagination, filter: search })}
  getKey={(user) => user.id}
  renderItem={(user) => <span>{user.name}</span>}
  onChange={(user) => console.log('selected', user)}
  placeholder="Search users…"
/>
```

### Props

| Prop | Type | Default | Required | Description |
|---|---|---|---|---|
| `query` | `DocumentNode` | — | Yes | GraphQL query document |
| `clientInstance` | `ApolloClient` | — | Yes | Apollo Client instance |
| `getItems` | `(data: TQuery) => TData[]` | — | Yes | Extract the item array from the query response |
| `getPagination` | `(data: TQuery) => PaginationResponse` | — | Yes | Extract pagination metadata from the query response |
| `getKey` | `(item: TData) => string \| number` | — | Yes | Stable React key for each list item |
| `renderItem` | `(item: TData) => ReactNode` | — | Yes | Render a single list row |
| `variables` | `(pagination, search?) => vars` | — | No | Variables factory |
| `onChange` | `(item: TData) => void` | — | No | Called when the user selects an item |
| `disabled` | `boolean` | `false` | No | Disables the input and dropdown |
| `placeholder` | `string` | — | No | Input placeholder text |
| `emptyText` | `string` | `'No Data'` | No | Message shown when the list is empty |
| `bottomOffset` | `number` | `30` | No | Scroll distance in px from the bottom that triggers the next page |
| `skip` | `boolean` | `false` | No | Skip query execution |
| `fetchPolicy` | `string` | `'cache-first'` | No | Apollo fetch policy |
| `defaultPagination` | `Pagination` | `{ pageNumber: 1, pageSize: 10 }` | No | Initial pagination |
| `debounceTime` | `number` | `500` | No | Search debounce delay in ms |

> **Note:** `InfiniteSelect` uses [Tailwind CSS](https://tailwindcss.com/) utility classes. Make sure Tailwind is configured in your project.

---

## `checkHasBottomReached`

A small utility for building your own infinite-scroll containers. Returns `true` when the scrollable element is within `bottomOffset` pixels of its bottom.

```tsx
import { checkHasBottomReached } from 'graphql-infinite-query';

<div
  style={{ height: 400, overflowY: 'auto' }}
  onScroll={e => {
    if (checkHasBottomReached(e, 50)) {
      loadNextPage();
    }
  }}
>
  {items.map(item => <Row key={item.id} item={item} />)}
</div>
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `event` | `UIEvent<HTMLDivElement>` | — | React scroll event from the scrollable container |
| `bottomOffset` | `number` | `30` | Pixels from the true bottom that still count as "reached" — increase for earlier pre-loading |

---

## License

MIT
