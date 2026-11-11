export type User = {
  id: string;
  name: string;
  email: string;
  color: string;
  createdAt: string;
};

/** What sign up, log in and refresh return. The refresh token travels only in an HttpOnly cookie. */
export type AuthResponse = {
  accessToken: string;
  expiresIn: number;
  user: User;
};
