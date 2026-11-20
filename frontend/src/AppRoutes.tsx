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
import { TripCompletePage } from './features/trip/TripCompletePage';
import { AccountClosedPage } from './features/privacy/AccountClosedPage';
import { DeleteAccountPage } from './features/privacy/DeleteAccountPage';
import { PolicyPage } from './features/privacy/PolicyPage';
import { PrivacyPage } from './features/privacy/PrivacyPage';
import { LiveMapPage } from './features/live/LiveMapPage';
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
          <RequireAuth allowGuest>
            <InvitePage />
          </RequireAuth>
        }
      />
      <Route
        path="/trip/:tripId"
        element={
          <RequireAuth allowGuest>
            <LiveMapPage />
          </RequireAuth>
        }
      />
      {/* The same page in the same place, so the map and its live connection carry on. */}
      <Route
        path="/trip/:tripId/eta"
        element={
          <RequireAuth allowGuest>
            <LiveMapPage view="eta" />
          </RequireAuth>
        }
      />
      <Route
        path="/trip/:tripId/friend/:memberId"
        element={
          <RequireAuth allowGuest>
            <LiveMapPage view="friend" />
          </RequireAuth>
        }
      />
      <Route
        path="/trip/:tripId/chat"
        element={
          <RequireAuth allowGuest>
            <LiveMapPage view="chat" />
          </RequireAuth>
        }
      />
      <Route
        path="/trip/:tripId/menu"
        element={
          <RequireAuth allowGuest>
            <LiveMapPage view="menu" />
          </RequireAuth>
        }
      />
      <Route
        path="/trip/:tripId/arrived"
        element={
          <RequireAuth allowGuest>
            <LiveMapPage view="arrived" />
          </RequireAuth>
        }
      />
      <Route
        path="/trip/:tripId/ended"
        element={
          <RequireAuth allowGuest>
            <TripCompletePage />
          </RequireAuth>
        }
      />
      <Route
        path="/me/privacy"
        element={
          <RequireAuth>
            <PrivacyPage />
          </RequireAuth>
        }
      />
      <Route
        path="/me/delete"
        element={
          <RequireAuth>
            <DeleteAccountPage />
          </RequireAuth>
        }
      />
      <Route path="/account-closed" element={<AccountClosedPage />} />
      <Route path="/privacy" element={<PolicyPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
