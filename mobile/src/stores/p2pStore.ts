/**
 * P2P Store
 * State management for peer-to-peer payments using Zustand
 */

import { create } from 'zustand';
import * as contactsService from '@/services/contacts.service';
import * as p2pApi from '@/services/p2p.api';
import type {
  Contact,
  P2PRecipient,
  PaymentRequest,
  SplitBill,
  SplitBillMember,
  P2PSendRequest,
  PaymentRequestCreate,
} from '@/types';

// ============================================================================
// P2P State Interface
// ============================================================================

interface P2PState {
  // Recipients state
  recentContacts: P2PRecipient[];
  allContacts: Contact[];
  tap2Contacts: Contact[];
  selectedRecipient: P2PRecipient | null;
  contactsSearchQuery: string;

  // Payment state
  sendAmount: number;
  sendNote: string;

  // Payment requests state
  incomingRequests: PaymentRequest[];
  outgoingRequests: PaymentRequest[];
  pendingRequestsCount: number;

  // Split bill state
  splitBillTitle: string;
  splitBillTotal: number;
  splitBillMembers: SplitBillMember[];
  splitBillType: 'equal' | 'custom';
  activeSplitBills: SplitBill[];

  // Loading states
  isLoadingContacts: boolean;
  isSendingMoney: boolean;
  isCreatingRequest: boolean;
  isLoadingRequests: boolean;
  isCreatingSplitBill: boolean;

  // Error states
  contactsError: string | null;
  sendError: string | null;
  requestError: string | null;
  splitBillError: string | null;

  // Actions - Contacts
  fetchRecentContacts: () => Promise<void>;
  fetchAllContacts: () => Promise<void>;
  searchContacts: (query: string) => Promise<void>;
  selectRecipient: (recipient: P2PRecipient) => void;
  clearRecipient: () => void;
  addToRecents: (userId: string, name: string, phone?: string, email?: string) => Promise<void>;

  // Actions - Send Money
  setSendAmount: (amount: number) => void;
  setSendNote: (note: string) => void;
  sendMoney: (paymentMethodId?: string) => Promise<void>;
  resetSendForm: () => void;

  // Actions - Payment Requests
  fetchPendingRequests: () => Promise<void>;
  createPaymentRequest: (data: PaymentRequestCreate) => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;

  // Actions - Split Bill
  setSplitBillTitle: (title: string) => void;
  setSplitBillTotal: (total: number) => void;
  setSplitBillType: (type: 'equal' | 'custom') => void;
  addSplitBillMember: (member: SplitBillMember) => void;
  removeSplitBillMember: (userId: string) => void;
  updateSplitBillMemberAmount: (userId: string, amount: number) => void;
  createSplitBill: () => Promise<void>;
  fetchActiveSplitBills: () => Promise<void>;
  resetSplitBillForm: () => void;

  // Actions - Errors
  clearErrors: () => void;
}

// ============================================================================
// P2P Store
// ============================================================================

export const useP2PStore = create<P2PState>((set, get) => ({
  // Initial state
  recentContacts: [],
  allContacts: [],
  tap2Contacts: [],
  selectedRecipient: null,
  contactsSearchQuery: '',

  sendAmount: 0,
  sendNote: '',

  incomingRequests: [],
  outgoingRequests: [],
  pendingRequestsCount: 0,

  splitBillTitle: '',
  splitBillTotal: 0,
  splitBillMembers: [],
  splitBillType: 'equal',
  activeSplitBills: [],

  isLoadingContacts: false,
  isSendingMoney: false,
  isCreatingRequest: false,
  isLoadingRequests: false,
  isCreatingSplitBill: false,

  contactsError: null,
  sendError: null,
  requestError: null,
  splitBillError: null,

  // ============================================================================
  // Contacts Actions
  // ============================================================================

  /**
   * Fetch recent contacts
   */
  fetchRecentContacts: async () => {
    set({ contactsError: null });
    try {
      const recent = await contactsService.getRecentContacts();
      set({ recentContacts: recent });
    } catch (error) {
      set({
        contactsError: error instanceof Error ? error.message : 'Failed to fetch recent contacts',
      });
    }
  },

  /**
   * Fetch all device contacts with Tap2 user matching
   */
  fetchAllContacts: async () => {
    set({ isLoadingContacts: true, contactsError: null });
    try {
      const contacts = await contactsService.getContactsWithTap2Users();
      const tap2Users = contacts.filter((c) => c.isTap2User);

      set({
        allContacts: contacts,
        tap2Contacts: tap2Users,
        isLoadingContacts: false,
      });
    } catch (error) {
      set({
        contactsError: error instanceof Error ? error.message : 'Failed to fetch contacts',
        isLoadingContacts: false,
      });
    }
  },

  /**
   * Search contacts
   */
  searchContacts: async (query) => {
    set({ contactsSearchQuery: query, contactsError: null });

    if (!query.trim()) {
      set({ tap2Contacts: get().allContacts.filter((c) => c.isTap2User) });
      return;
    }

    try {
      const results = await contactsService.searchContacts(query);
      set({ tap2Contacts: results.filter((c) => c.isTap2User) });
    } catch (error) {
      set({
        contactsError: error instanceof Error ? error.message : 'Failed to search contacts',
      });
    }
  },

  /**
   * Select a recipient
   */
  selectRecipient: (recipient) => {
    set({ selectedRecipient: recipient, sendError: null });
  },

  /**
   * Clear selected recipient
   */
  clearRecipient: () => {
    set({ selectedRecipient: null });
  },

  /**
   * Add contact to recent contacts
   */
  addToRecents: async (userId, name, phone, email) => {
    try {
      await contactsService.addToRecentContacts(userId, name, phone, email);
      // Refresh recent contacts
      const recent = await contactsService.getRecentContacts();
      set({ recentContacts: recent });
    } catch (error) {
      console.error('Error adding to recents:', error);
    }
  },

  // ============================================================================
  // Send Money Actions
  // ============================================================================

  /**
   * Set send amount
   */
  setSendAmount: (amount) => {
    set({ sendAmount: amount, sendError: null });
  },

  /**
   * Set send note
   */
  setSendNote: (note) => {
    set({ sendNote: note });
  },

  /**
   * Send money to selected recipient
   */
  sendMoney: async (paymentMethodId) => {
    const { selectedRecipient, sendAmount, sendNote } = get();

    if (!selectedRecipient) {
      set({ sendError: 'Please select a recipient' });
      return;
    }

    if (sendAmount <= 0) {
      set({ sendError: 'Please enter an amount' });
      return;
    }

    set({ isSendingMoney: true, sendError: null });

    try {
      const request: P2PSendRequest = {
        recipientId: selectedRecipient.id,
        amount: sendAmount,
        note: sendNote || undefined,
        paymentMethodId,
      };

      const response = await p2pApi.sendMoney(request);

      // Add to recent contacts
      await get().addToRecents(
        selectedRecipient.id,
        selectedRecipient.name,
        selectedRecipient.phone,
        selectedRecipient.email
      );

      set({
        isSendingMoney: false,
        sendAmount: 0,
        sendNote: '',
      });

      return response;
    } catch (error) {
      const errorMessage =
        error && typeof error === 'object' && 'response' in error
          ? ((error as { response: { data: { error: string } } }).response?.data?.error || 'Failed to send money')
          : 'Failed to send money';

      set({
        sendError: errorMessage,
        isSendingMoney: false,
      });
      throw error;
    }
  },

  /**
   * Reset send money form
   */
  resetSendForm: () => {
    set({
      selectedRecipient: null,
      sendAmount: 0,
      sendNote: '',
      sendError: null,
    });
  },

  // ============================================================================
  // Payment Requests Actions
  // ============================================================================

  /**
   * Fetch pending payment requests
   */
  fetchPendingRequests: async () => {
    set({ isLoadingRequests: true, requestError: null });
    try {
      const response = await p2pApi.getPendingRequests();

      set({
        incomingRequests: response.incoming,
        outgoingRequests: response.outgoing,
        pendingRequestsCount: response.incoming.length,
        isLoadingRequests: false,
      });
    } catch (error) {
      set({
        requestError: error instanceof Error ? error.message : 'Failed to fetch requests',
        isLoadingRequests: false,
      });
    }
  },

  /**
   * Create a payment request
   */
  createPaymentRequest: async (data) => {
    set({ isCreatingRequest: true, requestError: null });

    try {
      const response = await p2pApi.requestPayment(data);

      set({
        isCreatingRequest: false,
      });

      return response;
    } catch (error) {
      const errorMessage =
        error && typeof error === 'object' && 'response' in error
          ? ((error as { response: { data: { error: string } } }).response?.data?.error || 'Failed to create request')
          : 'Failed to create request';

      set({
        requestError: errorMessage,
        isCreatingRequest: false,
      });
      throw error;
    }
  },

  /**
   * Accept a payment request
   */
  acceptRequest: async (requestId) => {
    set({ isLoadingRequests: true, requestError: null });

    try {
      const response = await p2pApi.acceptPaymentRequest(requestId);

      // Remove from pending requests
      set((state) => ({
        incomingRequests: state.incomingRequests.filter((r) => r.id !== requestId),
        pendingRequestsCount: Math.max(0, state.pendingRequestsCount - 1),
        isLoadingRequests: false,
      }));

      return response;
    } catch (error) {
      set({
        requestError: error instanceof Error ? error.message : 'Failed to accept request',
        isLoadingRequests: false,
      });
      throw error;
    }
  },

  /**
   * Decline a payment request
   */
  declineRequest: async (requestId) => {
    set({ isLoadingRequests: true, requestError: null });

    try {
      await p2pApi.declinePaymentRequest(requestId);

      // Remove from pending requests
      set((state) => ({
        incomingRequests: state.incomingRequests.filter((r) => r.id !== requestId),
        pendingRequestsCount: Math.max(0, state.pendingRequestsCount - 1),
        isLoadingRequests: false,
      }));
    } catch (error) {
      set({
        requestError: error instanceof Error ? error.message : 'Failed to decline request',
        isLoadingRequests: false,
      });
      throw error;
    }
  },

  /**
   * Cancel an outgoing payment request
   */
  cancelRequest: async (requestId) => {
    set({ isLoadingRequests: true, requestError: null });

    try {
      await p2pApi.cancelPaymentRequest(requestId);

      // Remove from outgoing requests
      set((state) => ({
        outgoingRequests: state.outgoingRequests.filter((r) => r.id !== requestId),
        isLoadingRequests: false,
      }));
    } catch (error) {
      set({
        requestError: error instanceof Error ? error.message : 'Failed to cancel request',
        isLoadingRequests: false,
      });
      throw error;
    }
  },

  // ============================================================================
  // Split Bill Actions
  // ============================================================================

  /**
   * Set split bill title
   */
  setSplitBillTitle: (title) => {
    set({ splitBillTitle: title });
  },

  /**
   * Set split bill total
   */
  setSplitBillTotal: (total) => {
    set({ splitBillTotal: total, splitBillError: null });

    // Recalculate equal split amounts
    const { splitBillMembers, splitBillType } = get();
    if (splitBillType === 'equal' && splitBillMembers.length > 0) {
      const equalAmount = total / splitBillMembers.length;
      set({
        splitBillMembers: splitBillMembers.map((m) => ({ ...m, amount: equalAmount })),
      });
    }
  },

  /**
   * Set split bill type
   */
  setSplitBillType: (type) => {
    set({ splitBillType: type, splitBillError: null });

    // If switching to equal, recalculate amounts
    if (type === 'equal') {
      const { splitBillTotal, splitBillMembers } = get();
      if (splitBillMembers.length > 0) {
        const equalAmount = splitBillTotal / splitBillMembers.length;
        set({
          splitBillMembers: splitBillMembers.map((m) => ({ ...m, amount: equalAmount })),
        });
      }
    }
  },

  /**
   * Add a member to the split bill
   */
  addSplitBillMember: (member) => {
    set((state) => {
      const newMembers = [...state.splitBillMembers, member];

      // If equal split, recalculate all amounts
      if (state.splitBillType === 'equal' && state.splitBillTotal > 0) {
        const equalAmount = state.splitBillTotal / newMembers.length;
        return {
          splitBillMembers: newMembers.map((m) => ({ ...m, amount: equalAmount })),
        };
      }

      return { splitBillMembers: newMembers };
    });
  },

  /**
   * Remove a member from the split bill
   */
  removeSplitBillMember: (userId) => {
    set((state) => {
      const newMembers = state.splitBillMembers.filter((m) => m.userId !== userId);

      // If equal split, recalculate remaining amounts
      if (state.splitBillType === 'equal' && state.splitBillTotal > 0) {
        const equalAmount = newMembers.length > 0 ? state.splitBillTotal / newMembers.length : 0;
        return {
          splitBillMembers: newMembers.map((m) => ({ ...m, amount: equalAmount })),
        };
      }

      return { splitBillMembers: newMembers };
    });
  },

  /**
   * Update a specific member's amount (for custom splits)
   */
  updateSplitBillMemberAmount: (userId, amount) => {
    set((state) => ({
      splitBillMembers: state.splitBillMembers.map((m) =>
        m.userId === userId ? { ...m, amount } : m
      ),
      splitBillType: 'custom', // Switch to custom when manually editing
    }));
  },

  /**
   * Create a new split bill
   */
  createSplitBill: async () => {
    const { splitBillTitle, splitBillTotal, splitBillMembers, splitBillType } = get();

    if (!splitBillTitle.trim()) {
      set({ splitBillError: 'Please enter a title' });
      return;
    }

    if (splitBillTotal <= 0) {
      set({ splitBillError: 'Please enter a total amount' });
      return;
    }

    if (splitBillMembers.length === 0) {
      set({ splitBillError: 'Please add at least one member' });
      return;
    }

    // Verify amounts match total
    const membersTotal = splitBillMembers.reduce((sum, m) => sum + m.amount, 0);
    if (Math.abs(membersTotal - splitBillTotal) > 0.01) {
      set({ splitBillError: `Member amounts ($${membersTotal.toFixed(2)}) don't match total ($${splitBillTotal.toFixed(2)})` });
      return;
    }

    set({ isCreatingSplitBill: true, splitBillError: null });

    try {
      const memberIds = splitBillMembers
        .map((m) => m.userId)
        .filter((id): id is string => id !== undefined);

      const customAmounts =
        splitBillType === 'custom'
          ? splitBillMembers.reduce<Record<string, number>>((acc, m) => {
              if (m.userId) {
                acc[m.userId] = Math.round(m.amount * 100); // Convert to cents
              }
              return acc;
            }, {})
          : undefined;

      const response = await p2pApi.createSplitBill({
        title: splitBillTitle,
        totalAmount: splitBillTotal,
        memberIds,
        splitType: splitBillType,
        customAmounts,
      });

      // Refresh active split bills
      await get().fetchActiveSplitBills();

      set({
        isCreatingSplitBill: false,
      });

      // Reset form
      get().resetSplitBillForm();

      return response;
    } catch (error) {
      const errorMessage =
        error && typeof error === 'object' && 'response' in error
          ? ((error as { response: { data: { error: string } } }).response?.data?.error || 'Failed to create split bill')
          : 'Failed to create split bill';

      set({
        splitBillError: errorMessage,
        isCreatingSplitBill: false,
      });
      throw error;
    }
  },

  /**
   * Fetch active split bills
   */
  fetchActiveSplitBills: async () => {
    try {
      const response = await p2pApi.getSplitBills();
      set({ activeSplitBills: response.bills });
    } catch (error) {
      console.error('Error fetching split bills:', error);
    }
  },

  /**
   * Reset split bill form
   */
  resetSplitBillForm: () => {
    set({
      splitBillTitle: '',
      splitBillTotal: 0,
      splitBillMembers: [],
      splitBillType: 'equal',
      splitBillError: null,
    });
  },

  // ============================================================================
  // Error Actions
  // ============================================================================

  /**
   * Clear all errors
   */
  clearErrors: () => {
    set({
      contactsError: null,
      sendError: null,
      requestError: null,
      splitBillError: null,
    });
  },
}));
