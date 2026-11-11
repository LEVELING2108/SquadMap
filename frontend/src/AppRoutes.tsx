import { Route, Routes } from 'react-router';
import { NotFoundPage } from './features/foundation/NotFoundPage';
import { WelcomePage } from './features/welcome/WelcomePage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
