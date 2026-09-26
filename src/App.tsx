import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { ConfigError } from './components/ConfigError'
import { missingEnv } from './lib/supabase'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true, retry: 1 } },
})

export function App() {
  if (missingEnv.length > 0) return <ConfigError missing={missingEnv} />
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
