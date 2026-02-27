import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: string;
      walletAddress: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    role: string;
    walletAddress: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    walletAddress: string | null;
  }
}
