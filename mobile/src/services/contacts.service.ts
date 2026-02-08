/**
 * Contacts Service
 * Manages device contacts and integration with Tap2 users
 */

import { Platform, PermissionsAndroid, Alert } from 'react-native';
import Contacts, { Contact } from 'react-native-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Contact as Tap2Contact, P2PRecipient } from '@/types';
import { p2pApi } from './p2p.api';

// ============================================================================
// Constants
// ============================================================================

const CONTACTS_PERMISSION_KEY = '@tap2_contacts_permission_granted';
const RECENT_CONTACTS_KEY = '@tap2_recent_contacts';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// Types
// ============================================================================

export interface ContactsWithPermissionResult {
  granted: boolean;
  contacts: Tap2Contact[];
}

export interface RecentContact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  lastUsed: Date;
  timesUsed: number;
}

// ============================================================================
// Contacts Service
// ============================================================================

/**
 * Check and request contacts permission
 */
export async function requestContactsPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    // iOS handles permission through the native prompt
    return new Promise<boolean>((resolve) => {
      Contacts.checkPermission().then((permission) => {
        if (permission === 'undefined' || permission === 'not determined') {
          Contacts.requestPermission().then((newPermission) => {
            if (newPermission === 'authorized') {
              AsyncStorage.setItem(CONTACTS_PERMISSION_KEY, 'true');
              resolve(true);
            } else {
              resolve(false);
            }
          });
        } else if (permission === 'authorized') {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  } else {
    // Android requires explicit permission request
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        {
          title: 'Contacts Permission',
          message: 'Tap2 Wallet needs access to your contacts to send money to friends.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );

      const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
      if (isGranted) {
        await AsyncStorage.setItem(CONTACTS_PERMISSION_KEY, 'true');
      }
      return isGranted;
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
      return false;
    }
  }
}

/**
 * Check if contacts permission is granted
 */
export async function checkContactsPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const permission = await Contacts.checkPermission();
    return permission === 'authorized' || permission === 'authorized';
  } else {
    try {
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
      return granted;
    } catch {
      return false;
    }
  }
}

/**
 * Fetch all device contacts
 */
export async function fetchDeviceContacts(): Promise<Contact[]> {
  const hasPermission = await checkContactsPermission();

  if (!hasPermission) {
    const granted = await requestContactsPermission();
    if (!granted) {
      throw new Error('Contacts permission denied');
    }
  }

  return new Promise<Contact[]>((resolve, reject) => {
    Contacts.getAllWithoutPhotos()
      .then((contacts) => {
        resolve(contacts);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

/**
 * Convert react-native-contacts Contact to Tap2Contact format
 */
function convertToTap2Contact(contact: Contact): Tap2Contact {
  return {
    recordID: contact.recordID,
    givenName: contact.givenName || '',
    familyName: contact.familyName || '',
    middleName: contact.middleName,
    phoneNumbers: (contact.phoneNumbers || []).map((phone) => ({
      label: phone.label,
      number: phone.number,
    })),
    emailAddresses: (contact.emailAddresses || []).map((email) => ({
      label: email.label,
      email: email.email,
    })),
    thumbnailPath: contact.thumbnailPath,
    hasThumbnail: contact.hasThumbnail,
    isTap2User: false, // Will be updated when matching
  };
}

/**
 * Get contacts with Tap2 user matching
 */
export async function getContactsWithTap2Users(): Promise<Tap2Contact[]> {
  try {
    const deviceContacts = await fetchDeviceContacts();
    const tap2Contacts = deviceContacts.map(convertToTap2Contact);

    // Get phone numbers for batch lookup
    const phoneNumbers = tap2Contacts
      .flatMap((contact) =>
        contact.phoneNumbers.map((p) => {
          // Normalize phone number (remove non-digits, add country code if needed)
          let normalized = p.number.replace(/\D/g, '');
          if (!normalized.startsWith('+') && normalized.length === 10) {
            // Assume US number if 10 digits
            normalized = '+1' + normalized;
          }
          return normalized;
        })
      )
      .filter((phone) => phone.length > 10); // Only valid-looking numbers

    // Batch lookup Tap2 users
    const userMap = await p2pApi.lookupMultipleUsers(phoneNumbers);

    // Mark contacts that are Tap2 users
    tap2Contacts.forEach((contact) => {
      contact.phoneNumbers.forEach((phone) => {
        let normalized = phone.number.replace(/\D/g, '');
        if (!normalized.startsWith('+') && normalized.length === 10) {
          normalized = '+1' + normalized;
        }

        const tap2User = userMap[normalized];
        if (tap2User) {
          contact.isTap2User = true;
          contact.tap2UserId = tap2User.userId;
        }
      });
    });

    return tap2Contacts;
  } catch (error) {
    console.error('Error getting contacts with Tap2 users:', error);
    return [];
  }
}

/**
 * Search contacts by name
 */
export async function searchContacts(query: string): Promise<Tap2Contact[]> {
  try {
    const contacts = await getContactsWithTap2Users();
    const lowerQuery = query.toLowerCase();

    return contacts.filter((contact) => {
      const fullName = `${contact.givenName} ${contact.familyName}`.toLowerCase();
      return fullName.includes(lowerQuery);
    });
  } catch (error) {
    console.error('Error searching contacts:', error);
    return [];
  }
}

/**
 * Get recent contacts (from local storage)
 */
export async function getRecentContacts(): Promise<P2PRecipient[]> {
  try {
    const stored = await AsyncStorage.getItem(RECENT_CONTACTS_KEY);
    if (!stored) return [];

    const recent: RecentContact[] = JSON.parse(stored);

    // Filter to last 30 days and sort by usage frequency
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return recent
      .filter((rc) => new Date(rc.lastUsed) > thirtyDaysAgo)
      .sort((a, b) => b.timesUsed - a.timesUsed)
      .slice(0, 10)
      .map((rc) => ({
        id: rc.id,
        name: rc.name,
        phone: rc.phone,
        email: rc.email,
        isTap2User: true, // Assume recent contacts are Tap2 users
      }));
  } catch (error) {
    console.error('Error getting recent contacts:', error);
    return [];
  }
}

/**
 * Add contact to recent contacts
 */
export async function addToRecentContacts(
  userId: string,
  name: string,
  phone?: string,
  email?: string
): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(RECENT_CONTACTS_KEY);
    const recent: RecentContact[] = stored ? JSON.parse(stored) : [];

    const existingIndex = recent.findIndex((rc) => rc.id === userId);

    if (existingIndex >= 0) {
      // Update existing
      recent[existingIndex].lastUsed = new Date().toISOString();
      recent[existingIndex].timesUsed += 1;
    } else {
      // Add new
      recent.push({
        id: userId,
        name,
        phone,
        email,
        lastUsed: new Date().toISOString(),
        timesUsed: 1,
      });
    }

    // Keep only last 50 recent contacts
    const trimmed = recent.sort((a, b) => {
      const dateA = new Date(a.lastUsed).getTime();
      const dateB = new Date(b.lastUsed).getTime();
      return dateB - dateA;
    }).slice(0, 50);

    await AsyncStorage.setItem(RECENT_CONTACTS_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Error adding to recent contacts:', error);
  }
}

/**
 * Format contact display name
 */
export function formatContactName(contact: Tap2Contact): string {
  const parts = [contact.givenName, contact.middleName, contact.familyName].filter(Boolean);
  return parts.join(' ') || 'Unknown Contact';
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/\D/g, '');

  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned[0]} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  return phoneNumber;
}

/**
 * Get initial letters for avatar
 */
export function getContactInitials(contact: Tap2Contact): string {
  const firstName = contact.givenName?.[0] || '';
  const lastName = contact.familyName?.[0] || '';

  return (firstName + lastName).toUpperCase().slice(0, 2) || '?';
}

// ============================================================================
// Contacts Service Object (for convenience)
// ============================================================================

export const contactsService = {
  requestContactsPermission,
  checkContactsPermission,
  fetchDeviceContacts,
  getContactsWithTap2Users,
  searchContacts,
  getRecentContacts,
  addToRecentContacts,
  formatContactName,
  formatPhoneNumber,
  getContactInitials,
};
