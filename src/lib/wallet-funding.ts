// Auto-Wallet Funding Service
// Automatically funds new user wallets with gas money for transactions

import { ethers } from 'ethers';

const BACKEND_PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';

// Amount to fund each new wallet (0.001 MATIC = ~5-10 transactions)
// Reduced for hackathon/student use to conserve backend wallet balance
const FUNDING_AMOUNT = '0.001'; // in MATIC

/**
 * Fund a new user wallet with gas money
 * Called automatically when user signs up
 */
export async function fundNewUserWallet(userAddress: string): Promise<string> {
    try {
        console.log(`💰 Funding new user wallet: ${userAddress}`);

        // Connect backend wallet
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const backendWallet = new ethers.Wallet(BACKEND_PRIVATE_KEY, provider);

        // Check backend wallet balance
        const balance = await provider.getBalance(backendWallet.address);
        const balanceInMatic = ethers.formatEther(balance);

        console.log(`Backend wallet balance: ${balanceInMatic} MATIC`);

        // Check if backend has enough funds
        const fundingAmountWei = ethers.parseEther(FUNDING_AMOUNT);
        if (balance < fundingAmountWei) {
            throw new Error(`Insufficient backend wallet balance. Need ${FUNDING_AMOUNT} MATIC, have ${balanceInMatic} MATIC`);
        }

        // Send MATIC to new user wallet
        const tx = await backendWallet.sendTransaction({
            to: userAddress,
            value: fundingAmountWei,
        });

        console.log(`⏳ Funding transaction sent: ${tx.hash}`);

        // Wait for confirmation
        await tx.wait();

        console.log(`✅ User wallet funded successfully!`);

        return tx.hash;
    } catch (error: any) {
        console.error('❌ Error funding user wallet:', error.message);

        // Don't fail signup if funding fails - just log it
        // User can still be created, they just won't be able to transact yet
        return '';
    }
}

/**
 * Check if a wallet needs funding
 */
export async function checkWalletBalance(address: string): Promise<string> {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
}
