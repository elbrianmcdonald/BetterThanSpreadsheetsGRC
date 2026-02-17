/**
 * Password Service
 *
 * Handles password hashing and verification for local authentication.
 * Uses bcrypt with 12 salt rounds for secure password storage.
 */

import bcrypt from 'bcryptjs';
import { z } from 'zod';

/**
 * Password strength requirements for local authentication
 *
 * Requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

/**
 * Hash a plain text password using bcrypt
 *
 * @param password - Plain text password to hash
 * @returns Hashed password string
 * @throws Error if hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Validate password strength
    passwordSchema.parse(password);

    // Hash with 12 salt rounds (industry standard for strong security)
    const hashedPassword = await bcrypt.hash(password, 12);
    return hashedPassword;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Password validation failed: ${error.errors.map((e) => e.message).join(', ')}`);
    }
    throw new Error('Failed to hash password');
  }
}

/**
 * Verify a plain text password against a hashed password
 *
 * @param password - Plain text password to verify
 * @param hashedPassword - Hashed password to compare against
 * @returns true if password matches, false otherwise
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    const isValid = await bcrypt.compare(password, hashedPassword);
    return isValid;
  } catch (error) {
    console.error('[PASSWORD-SERVICE] Error verifying password:', error);
    return false;
  }
}

/**
 * Generate a random secure password (for initial user creation)
 *
 * Generates a password that meets all strength requirements:
 * - 16 characters long
 * - Mix of uppercase, lowercase, numbers, and special characters
 *
 * @returns Generated password string
 */
export function generateSecurePassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const all = uppercase + lowercase + numbers + special;

  let password = '';

  // Ensure at least one of each required character type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill remaining characters randomly
  for (let i = password.length; i < 16; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password to randomize character positions
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

/**
 * Validate password strength (for client-side validation)
 *
 * @param password - Password to validate
 * @returns Validation result with success and error messages
 */
export function validatePasswordStrength(password: string): {
  success: boolean;
  errors: string[];
} {
  try {
    passwordSchema.parse(password);
    return { success: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map((e) => e.message),
      };
    }
    return {
      success: false,
      errors: ['Password validation failed'],
    };
  }
}
