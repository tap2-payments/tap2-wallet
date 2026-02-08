/**
 * ContactListItem Component
 * Displays a contact with Tap2 user badge
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Contact } from '@/types';
import { contactsService } from '@/services/contacts.service';

export interface ContactListItemProps {
  contact: Contact;
  onPress: (contact: Contact) => void;
  showPhone?: boolean;
  style?: any;
}

export const ContactListItem: React.FC<ContactListItemProps> = ({
  contact,
  onPress,
  showPhone = false,
  style,
}) => {
  const displayName = contactsService.formatContactName(contact);
  const initials = contactsService.getContactInitials(contact);
  const phoneNumber = contact.phoneNumbers[0]?.number;

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed, style]}
      onPress={() => onPress(contact)}
    >
      {/* Avatar */}
      <View style={styles.avatar}>
        {contact.hasThumbnail && contact.thumbnailPath ? (
          <Image
            source={{ uri: contact.thumbnailPath }}
            style={styles.avatarImage}
          />
        ) : (
          <Text style={styles.avatarText}>{initials}</Text>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {contact.isTap2User && (
            <View style={styles.tap2Badge}>
              <Text style={styles.tap2BadgeText}>Tap2</Text>
            </View>
          )}
        </View>
        {showPhone && phoneNumber && (
          <Text style={styles.phone}>
            {contactsService.formatPhoneNumber(phoneNumber)}
          </Text>
        )}
      </View>

      {/* Chevron */}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pressed: {
    backgroundColor: '#F5F5F5',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginRight: 8,
  },
  tap2Badge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tap2BadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  phone: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: '#C0C0C0',
    marginLeft: 8,
  },
});
