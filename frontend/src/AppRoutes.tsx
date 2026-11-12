import { Route, Routes } from 'react-router';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { GuestOnly } from './features/auth/GuestOnly';
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { SignupPage } from './features/auth/SignupPage';
import { NotFoundPage } from './features/foundation/NotFoundPage';
import { HomePage } from './features/home/HomePage';
import { ConsentPage } from './features/invite/ConsentPage';
import { ExpiredPage } from './features/invite/ExpiredPage';
import { JoinPage } from './features/invite/JoinPage';
import { InvitePage } from './features/trip/InvitePage';
import { TripPlaceholderPage } from './features/trip/TripPlaceholderPage';
import { WelcomePage } from './features/welcome/WelcomePage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        path="/signup"
        element={
          <GuestOnly>
            <SignupPage />
          </GuestOnly>
        }
      />
      <Route path="/forgot" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/join/expired" element={<ExpiredPage />} />
      <Route path="/join/:code" element={<JoinPage />} />
      <Route path="/join/:code/consent" element={<ConsentPage />} />
      <Route
        path="/trip/:tripId/invite"
        element={
          <RequireAuth>
            <InvitePage />
          </RequireAuth>
        }
      />
      <Route
        path="/trip/:tripId"
        element={
          <RequireAuth allowGuest>
            <TripPlaceholderPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
