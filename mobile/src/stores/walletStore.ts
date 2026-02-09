import { create } from 'zustand';

import type { Transaction } from '@/types';

interface WalletState {
  balance: number;
  transactions: Transaction[];
  setBalance: (balance: number) => void;
  addTransaction: (transaction: Transaction) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  balance: 0,
  transactions: [],
  setBalance: (balance) => set({ balance }),
  addTransaction: (transaction) =>
    set((state) => ({
      transactions: [...state.transactions, transaction],
    })),
}));
