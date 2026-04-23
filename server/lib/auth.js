import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 12;
const JWT_EXPIRES_IN = '7d';

export const hashPassword  = (password)       => bcrypt.hash(password, SALT_ROUNDS);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);
export const signToken      = (payload)        => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
export const verifyToken    = (token)          => jwt.verify(token, process.env.JWT_SECRET);
