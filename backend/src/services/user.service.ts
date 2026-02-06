import { prisma } from '../config/database.js';

export class UserService {
  async findByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  async findByPhone(phone: string) {
    return await prisma.user.findUnique({
      where: { phone },
    });
  }

  async findByAuth0Id(auth0Id: string) {
    return await prisma.user.findUnique({
      where: { auth0Id },
      include: { wallet: true },
    });
  }

  async createUser(data: { email: string; phone: string; auth0Id?: string }) {
    const user = await prisma.user.create({
      data,
    });

    // Create wallet for new user
    await prisma.wallet.create({
      data: {
        userId: user.id,
        balance: 0,
        currency: 'USD',
      },
    });

    return user;
  }

  async updateKYC(userId: string, verified: boolean) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        kycVerified: verified,
        kycVerifiedAt: verified ? new Date() : null,
      },
    });
  }
}
