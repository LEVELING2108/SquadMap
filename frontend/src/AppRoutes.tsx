import { Route, Routes } from 'react-router';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { GuestOnly } from './features/auth/GuestOnly';
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { SignupPage } from './features/auth/SignupPage';
import { NotFoundPage } from './features/foundation/NotFoundPage';
import { AlertsPage } from './features/alerts/AlertsPage';
import { TripHistoryPage } from './features/history/TripHistoryPage';
import { HomePage } from './features/home/HomePage';
import { ChangeEmailPage } from './features/profile/ChangeEmailPage';
import { ChangePasswordPage } from './features/profile/ChangePasswordPage';
import { EditProfilePage } from './features/profile/EditProfilePage';
import { ProfilePage } from './features/profile/ProfilePage';
import { SettingsPage } from './features/profile/SettingsPage';
import { ConsentPage } from './features/invite/ConsentPage';
import { ExpiredPage } from './features/invite/ExpiredPage';
import { JoinPage } from './features/invite/JoinPage';
import { ChooseOnMapPage } from './features/newTrip/ChooseOnMapPage';
import { DestinationPage } from './features/newTrip/DestinationPage';
import { NewTripPage } from './features/newTrip/NewTripPage';
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
        path="/me"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="/me/edit"
        element={
          <RequireAuth>
            <EditProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="/me/password"
        element={
          <RequireAuth>
            <ChangePasswordPage />
          </RequireAuth>
        }
      />
      <Route
        path="/me/email"
        element={
          <RequireAuth>
            <ChangeEmailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/me/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/me/alerts"
        element={
          <RequireAuth>
            <AlertsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/me/history"
        element={
          <RequireAuth>
            <TripHistoryPage />
          </RequireAuth>
        }
      />
      <Route
        path="/trip/new"
        element={
          <RequireAuth>
            <NewTripPage />
          </RequireAuth>
        }
      />
      <Route
        path="/trip/new/destination"
        element={
          <RequireAuth>
            <DestinationPage />
          </RequireAuth>
        }
      />
      <Route
        path="/trip/new/map"
        element={
          <RequireAuth>
            <ChooseOnMapPage />
          </RequireAuth>
        }
      />
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
