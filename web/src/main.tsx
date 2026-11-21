import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { onSessionEnd } from './api/client';
import { App } from './App';
import { endSession } from './hooks/useSession';
import './index.css';
import { createQueryClient } from './query-client';

const queryClient = createQueryClient();

// O cookie de renovação venceu no meio do uso: a sessão acaba, e as telas
// protegidas levam para a tela de entrar.
onSessionEnd(() => endSession(queryClient));

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
