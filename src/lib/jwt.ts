import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '30d';

export interface JwtPayload {
  uid: string;
  email: string;
}

export function signToken(payload: JwtPayload): string {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
