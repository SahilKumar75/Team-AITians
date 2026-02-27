// Mock Wallet Service
// Mock Wallet Service
export const prisma = {
    patientProfile: {
        findMany: async (args?: any) => [],
        findFirst: async (args?: any) => null,
        create: async (args?: any) => null,
        update: async (args?: any) => null,
    },
    user: {
        findUnique: async (args?: any) => null,
        findFirst: async (args?: any) => null,
    },
    journey: {
        findFirst: async (args?: any) => null,
        create: async (args?: any) => null,
        update: async (args?: any) => null,
    }
}; // Mock Prisma client

export const getWallet = async (userId: string) => {
    // console.log("Mock getWallet", userId);
    return null;
}

export const createWallet = async (userId: string) => {
    // console.log("Mock createWallet", userId);
    return null;
}
