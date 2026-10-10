import bcrypt from 'bcrypt'

export const DEFAULT_PASSWORD = '1234'

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10)
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash)
}
