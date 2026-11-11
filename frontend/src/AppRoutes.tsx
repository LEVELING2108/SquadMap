import { Route, Routes } from 'react-router';
import { FoundationPage } from './features/foundation/FoundationPage';
import { NotFoundPage } from './features/foundation/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<FoundationPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
