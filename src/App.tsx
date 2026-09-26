import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { ConfigError } from './components/ConfigError'
import { clearAdminCacheOnUserChange } from './lib/authCache'
import { missingEnv, supabase } from './lib/supabase'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true, retry: 1 } },
})

export function App() {
  useEffect(() => clearAdminCacheOnUserChange(supabase.auth, queryClient), [])
  if (missingEnv.length > 0) return <ConfigError missing={missingEnv} />
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
