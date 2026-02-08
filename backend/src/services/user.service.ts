/**
 * User Service
 * Handles user profile operations, KYC management, and user lookups
 */

import { eq, or } from 'drizzle-orm'
import { initDB, users, wallets } from '../config/database.js'
import type { User, NewUser, Wallet } from '../config/database.js'
import type { ProfileUpdateInput } from '../types/auth.js'

/**
 * User profile response (safe to expose to clients)
 */
export interface UserProfile {
  id: string
  email: string
  phone: string
  auth0Id?: string
  kycVerified: boolean
  kycVerifiedAt?: Date | null
  createdAt: Date
}

/**
 * User lookup options
 */
export interface UserLookupOptions {
  includeWallet?: boolean
}

export class UserService {
  /**
   * Find user by email
   */
  async findByEmail(db: D1Database, email: string) {
    const dbClient = initDB(db)
    return await dbClient.query.users.findFirst({
      where: eq(users.email, email),
    })
  }

  /**
   * Find user by phone
   */
  async findByPhone(db: D1Database, phone: string) {
    const dbClient = initDB(db)
    return await dbClient.query.users.findFirst({
      where: eq(users.phone, phone),
    })
  }

  /**
   * Find user by Auth0 ID
   */
  async findByAuth0Id(db: D1Database, auth0Id: string) {
    const dbClient = initDB(db)
    return await dbClient.query.users.findFirst({
      where: eq(users.auth0Id, auth0Id),
    })
  }

  /**
   * Find user by ID
   */
  async findById(db: D1Database, userId: string, options: UserLookupOptions = {}) {
    const dbClient = initDB(db)
    return await dbClient.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        wallet: options.includeWallet ?? false,
      },
    })
  }

  /**
   * Find user by email or phone
   * Useful for login where user provides one identifier
   */
  async findByEmailOrPhone(
    db: D1Database,
    email?: string,
    phone?: string
  ) {
    const dbClient = initDB(db)

    if (!email && !phone) {
      return null
    }

    if (email && phone) {
      return await dbClient.query.users.findFirst({
        where: or(eq(users.email, email), eq(users.phone, phone)),
      })
    }

    if (email) {
      return await dbClient.query.users.findFirst({
        where: eq(users.email, email),
      })
    }

    if (phone) {
      return await dbClient.query.users.findFirst({
        where: eq(users.phone, phone),
      })
    }

    return null
  }

  /**
   * Create a new user with optional password hash
   */
  async createUser(
    db: D1Database,
    data: {
      email: string
      phone: string
      auth0Id?: string
      passwordHash?: string
      passwordSalt?: string
      passwordIterations?: number
    }
  ): Promise<User> {
    const dbClient = initDB(db)

    const newUser: NewUser = {
      id: crypto.randomUUID(),
      email: data.email,
      phone: data.phone,
      auth0Id: data.auth0Id,
      passwordHash: data.passwordHash,
      passwordSalt: data.passwordSalt,
      passwordIterations: data.passwordIterations ?? 100000,
      kycVerified: false,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    }

    const result = await dbClient.insert(users).values(newUser).returning()

    // Create wallet for new user
    const newWallet: Wallet = {
      id: crypto.randomUUID(),
      userId: newUser.id,
      balance: 0, // Stored in cents
      currency: 'USD',
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    }

    await dbClient.insert(wallets).values(newWallet)

    return result[0]!
  }

  /**
   * Get user profile by ID
   */
  async getProfile(db: D1Database, userId: string): Promise<UserProfile | null> {
    const user = await this.findById(db, userId)

    if (!user) {
      return null
    }

    return this.formatUserProfile(user)
  }

  /**
   * Update user profile
   */
  async updateProfile(
    db: D1Database,
    userId: string,
    updates: ProfileUpdateInput
  ): Promise<UserProfile | null> {
    const dbClient = initDB(db)

    // Check if user exists
    const existingUser = await this.findById(db, userId)
    if (!existingUser) {
      return null
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: Math.floor(Date.now() / 1000),
    }

    if (updates.email) {
      // Check if email is already taken by another user
      const emailExists = await this.findByEmail(db, updates.email)
      if (emailExists && emailExists.id !== userId) {
        throw new Error('Email already in use')
      }
      updateData.email = updates.email
    }

    if (updates.phone) {
      // Check if phone is already taken by another user
      const phoneExists = await this.findByPhone(db, updates.phone)
      if (phoneExists && phoneExists.id !== userId) {
        throw new Error('Phone already in use')
      }
      updateData.phone = updates.phone
    }

    // Update user
    await dbClient
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))

    // Return updated user
    const updatedUser = await this.findById(db, userId)
    return updatedUser ? this.formatUserProfile(updatedUser) : null
  }

  /**
   * Update KYC verification status
   */
  async updateKYC(
    db: D1Database,
    userId: string,
    verified: boolean
  ): Promise<UserProfile | null> {
    const dbClient = initDB(db)

    // Check if user exists
    const existingUser = await this.findById(db, userId)
    if (!existingUser) {
      return null
    }

    // Update KYC status
    await dbClient
      .update(users)
      .set({
        kycVerified: verified,
        kycVerifiedAt: verified ? Math.floor(Date.now() / 1000) : null,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(users.id, userId))

    // Return updated user
    const updatedUser = await this.findById(db, userId)
    return updatedUser ? this.formatUserProfile(updatedUser) : null
  }

  /**
   * Update user's PIN hash
   */
  async updatePin(
    db: D1Database,
    userId: string,
    pinHash: string,
    pinSalt: string
  ): Promise<void> {
    const dbClient = initDB(db)

    await dbClient
      .update(users)
      .set({
        pinHash,
        pinSalt,
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .where(eq(users.id, userId))
  }

  /**
   * Check if user has a PIN set
   */
  async hasPinSet(db: D1Database, userId: string): Promise<boolean> {
    const user = await this.findById(db, userId)
    return !!user?.pinHash
  }

  /**
   * Format user profile for client response
   * Excludes sensitive data like password hash and PIN hash
   */
  private formatUserProfile(user: User): UserProfile {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      auth0Id: user.auth0Id ?? undefined,
      kycVerified: user.kycVerified ?? false,
      kycVerifiedAt: user.kycVerifiedAt
        ? new Date((user.kycVerifiedAt as number) * 1000)
        : null,
      createdAt: new Date((user.createdAt as number) * 1000),
    }
  }

  /**
   * Delete a user (soft delete by deactivating)
   * Note: This is for admin use only
   */
  async deactivateUser(db: D1Database, userId: string): Promise<boolean> {
    const dbClient = initDB(db)

    const result = await dbClient
      .update(users)
      .set({
        updatedAt: Math.floor(Date.now() / 1000),
        // We could add a `deletedAt` field to the schema
        // For now, this is a placeholder
      })
      .where(eq(users.id, userId))

    return result.rowCount > 0
  }
}
