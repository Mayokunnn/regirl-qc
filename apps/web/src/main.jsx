import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// vite-plugin-pwa handles SW generation and caching automatically.
// autoUpdate: silently updates the SW in the background when a new build is deployed.
registerSW({ immediate: true })

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Show cached data instantly on revisit, refetch in the background.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
