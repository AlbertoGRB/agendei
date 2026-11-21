import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { GuestOnly, RequireAuth, RequireRole } from './components/RequireAuth';
import { BookPage } from './pages/BookPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RegisterPage } from './pages/RegisterPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route element={<GuestOnly />}>
          <Route path="entrar" element={<LoginPage />} />
          <Route path="cadastro" element={<RegisterPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route index element={<HomePage />} />
          <Route element={<RequireRole allowed="CLIENT" />}>
            <Route path="prestadores/:providerId" element={<BookPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
