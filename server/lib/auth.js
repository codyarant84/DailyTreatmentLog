import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 12;
const JWT_EXPIRES_IN = '7d';
const PORTAL_JWT_EXPIRES_IN = '30d';

export const hashPassword  = (password)       => bcrypt.hash(password, SALT_ROUNDS);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);
export const signToken      = (payload, expiresIn = JWT_EXPIRES_IN) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
export const verifyToken    = (token)          => jwt.verify(token, process.env.JWT_SECRET);

export const signPortalToken = (payload, expiresIn = PORTAL_JWT_EXPIRES_IN) =>
  jwt.sign({ sub: 'portal', ...payload }, process.env.JWT_SECRET, { expiresIn });
