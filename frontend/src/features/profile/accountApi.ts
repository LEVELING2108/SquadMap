import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api/client';
import { useSession } from '../auth/session';
import type { User } from '../auth/types';

/** The colours a profile can use, from the server, which checks every change against them. */
export function useAvatarColors() {
  return useQuery({
    queryKey: ['me', 'colors'],
    queryFn: () => api<string[]>('/me/colors'),
    staleTime: Infinity,
  });
}

export function updateProfile(changes: { name?: string; color?: string }): Promise<User> {
  return api<User>('/me', { method: 'PATCH', body: changes });
}

export function changeEmail(email: string, password: string): Promise<User> {
  return api<User>('/me/email', { method: 'PUT', body: { email, password } });
}

/** Ends every other session; this device stays signed in. */
export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return api<void>('/auth/password', { method: 'POST', body: { currentPassword, newPassword } });
}

export function logOutOtherDevices(): Promise<void> {
  return api<void>('/auth/logout-others', { method: 'POST' });
}

/** After a change, the session shows the account as the server now has it. */
export function rememberUser(user: User): void {
  useSession.setState({ user });
}
