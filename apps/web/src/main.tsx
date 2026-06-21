import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import { router } from './app/router'
import { RealtimeProvider } from './features/live'
import { ToastProvider, OfflineIndicator } from './shared/ui'
import i18n from './shared/i18n/i18n'
import './index.css'
import './shared/tokens/tokens.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <OfflineIndicator />
          <RealtimeProvider>
            <RouterProvider router={router} />
          </RealtimeProvider>
        </ToastProvider>
      </QueryClientProvider>
    </I18nextProvider>
  </React.StrictMode>,
)
