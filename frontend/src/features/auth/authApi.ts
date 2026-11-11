import { api } from '../../lib/api/client';
import { setSignedIn } from './session';
import type { AuthResponse } from './types';

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  acceptedTerms: boolean;
}) {
  const response = await api<AuthResponse>('/auth/signup', { method: 'POST', body: input });
  setSignedIn(response);
  return response;
}

export async function logIn(input: { email: string; password: string }) {
  const response = await api<AuthResponse>('/auth/login', { method: 'POST', body: input });
  setSignedIn(response);
  return response;
}

export function requestResetLink(email: string): Promise<void> {
  return api<void>('/auth/forgot', { method: 'POST', body: { email } });
}

export function resetPassword(token: string, password: string): Promise<void> {
  return api<void>('/auth/reset', { method: 'POST', body: { token, password } });
}
