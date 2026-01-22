import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import config from './config';

export interface SessionData {
  userId?: string;
}

export const sessionOptions: SessionOptions = {
  password: config.sessionSecret,
  cookieName: 'collab-hub-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  return session;
}
