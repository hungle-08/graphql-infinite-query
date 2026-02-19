# graphql-infinite-query

React hook and select component for GraphQL infinite scroll / pagination with Apollo Client.

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

## `useInfiniteLoadQuery`

The hook expects the GraphQL response to follow this shape:

```graphql
{
  queryName {
    pagination { pageNumber pageSize total totalPage }
    items { ... }
  }
}
```

### Usage

```tsx
import { useInfiniteLoadQuery } from 'graphql-infinite-query';
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
    data,
    loading,
    isFetchingMore,
    hasNextPage,
    loadNextPage,
    onSearch,
    reset,
  } = useInfiniteLoadQuery({
    query: GET_USERS,
    clientInstance: client,
    variables: (pagination, search) => ({
      pagination,
      filter: search,
    }),
  });

  return (
    <div onScroll={e => { if (checkHasBottomReached(e)) loadNextPage(); }}>
      {data.map(user => <div key={user.id}>{user.name}</div>)}
      {isFetchingMore && <span>Loading more...</span>}
    </div>
  );
}
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `query` | `DocumentNode` | — | GraphQL query document |
| `clientInstance` | `ApolloClient` | — | Apollo Client instance |
| `variables` | `(pagination, search?) => TVariables` | `{ pagination, filter: search }` | Variables factory |
| `skip` | `boolean` | `false` | Skip query execution |
| `fetchPolicy` | `string` | `'cache-first'` | Apollo fetch policy |
| `defaultPagination` | `Pagination` | `{ pageNumber: 1, pageSize: 10 }` | Initial page |
| `debounceTime` | `number` | `500` | Search debounce in ms |
| `context` | `DefaultContext` | — | Apollo context (headers, auth…) |

### Returns

| Value | Type | Description |
|---|---|---|
| `data` | `TData[]` | Accumulated items across all pages |
| `loading` | `boolean` | `true` while any request is in flight |
| `isFetchingMore` | `boolean` | `true` only during next-page fetch |
| `hasNextPage` | `boolean` | `true` when more pages are available |
| `loadNextPage` | `() => void` | Fetch and append the next page |
| `onSearch` | `DebouncedFunc` | Debounced search handler |
| `onSearchImmediate` | `(value: string) => void` | Non-debounced search |
| `searchValue` | `string \| null` | Current search string |
| `pagination` | `PaginationResponse` | Latest pagination metadata |
| `reset` | `() => void` | Clear search and refetch from page 1 |
| `error` | `ApolloError \| undefined` | Error from last failed request |

---

## `InfiniteSelect`

A ready-made searchable dropdown that combines the hook with an input and a scrollable list.

```tsx
import { InfiniteSelect } from 'graphql-infinite-query';

<InfiniteSelect<DataResponseType>
  query={GET_USERS}
  clientInstance={client}
  variables={(pagination, search) => ({ pagination, filter: search })}
  getKey={user => user.id}
  renderItem={user => <span>{user.name}</span>}
  onChange={user => console.log('selected', user)}
  placeholder="Search users..."
/>
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `query` | `DocumentNode` | — | GraphQL query document |
| `clientInstance` | `ApolloClient` | — | Apollo Client instance |
| `getKey` | `(item) => string \| number` | — | Stable React key for each item |
| `renderItem` | `(item) => ReactNode` | — | Render content of a list row |
| `variables` | `(pagination, search?) => vars` | — | Variables factory |
| `onChange` | `(item) => void` | — | Called on item selection |
| `disabled` | `boolean` | `false` | Disables input and dropdown |
| `placeholder` | `string` | — | Input placeholder text |
| `emptyText` | `string` | `'No Data'` | Shown when list is empty |
| `bottomOffset` | `number` | `30` | Scroll distance (px) to trigger next page |
| `skip` | `boolean` | `false` | Skip query execution |
| `fetchPolicy` | `string` | `'cache-first'` | Apollo fetch policy |
| `defaultPagination` | `Pagination` | `{ pageNumber: 1, pageSize: 10 }` | Initial page |
| `debounceTime` | `number` | `500` | Search debounce in ms |

> **Note:** `InfiniteSelect` uses [Tailwind CSS](https://tailwindcss.com/) utility classes. Make sure Tailwind is configured in your project.

---

## `checkHasBottomReached`

```tsx
import { checkHasBottomReached } from 'graphql-infinite-query';

<div onScroll={e => {
  if (checkHasBottomReached(e, 50)) {
    loadNextPage();
  }
}}>
  {items}
</div>
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `event` | `UIEvent<HTMLDivElement>` | — | React scroll event |
| `bottomOffset` | `number` | `30` | Pixels from bottom that count as "reached" |

## License

MIT
