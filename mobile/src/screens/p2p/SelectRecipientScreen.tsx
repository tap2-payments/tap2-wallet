/**
 * SelectRecipientScreen
 * Contact picker with search and Tap2 user badges
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { useP2PStore } from '@/stores/p2pStore';
import { ContactListItem } from '@/components/p2p';
import { contactsService } from '@/services/contacts.service';
import type { Contact } from '@/types';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'SelectRecipient'>;

export const SelectRecipientScreen: React.FC<Props> = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const {
    recentContacts,
    allContacts,
    tap2Contacts,
    isLoadingContacts,
    contactsError,
    fetchAllContacts,
    selectRecipient,
  } = useP2PStore();

  useEffect(() => {
    fetchAllContacts();
  }, []);

  useEffect(() => {
    filterContacts();
  }, [searchQuery, tap2Contacts]);

  const filterContacts = () => {
    setIsSearching(true);

    setTimeout(() => {
      if (!searchQuery.trim()) {
        setFilteredContacts(tap2Contacts);
      } else {
        const query = searchQuery.toLowerCase();
        const filtered = tap2Contacts.filter((contact) => {
          const name = contactsService.formatContactName(contact).toLowerCase();
          const phones = contact.phoneNumbers
            .map((p) => p.number)
            .join(' ')
            .toLowerCase();
          return name.includes(query) || phones.includes(query);
        });
        setFilteredContacts(filtered);
      }
      setIsSearching(false);
    }, 100);
  };

  const handleSelectContact = (contact: Contact) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    selectRecipient({
      id: contact.tap2UserId || contact.recordID,
      name: contactsService.formatContactName(contact),
      phone: contact.phoneNumbers[0]?.number,
      isTap2User: contact.isTap2User || false,
    });

    navigation.goBack();
  };

  const handleSelectRecent = (contact: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    selectRecipient(contact);
    navigation.goBack();
  };

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const renderRecentItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.recentItem}
      onPress={() => handleSelectRecent(item)}
    >
      <View style={styles.recentAvatar}>
        <Text style={styles.recentAvatarText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text style={styles.recentName}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderContactItem = ({ item }: { item: Contact }) => (
    <ContactListItem
      contact={item}
      onPress={handleSelectContact}
      showPhone
    />
  );

  const renderListHeader = () => {
    if (searchQuery.trim()) return null;

    return (
      <>
        {recentContacts.length > 0 && (
          <>
            {renderSectionHeader('Recent')}
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={recentContacts}
              renderItem={renderRecentItem}
              keyExtractor={(item) => item.id}
              style={styles.recentList}
              contentContainerStyle={styles.recentListContent}
            />
          </>
        )}
        {renderSectionHeader(`All Tap2 Users (${tap2Contacts.length})`)}
      </>
    );
  };

  const renderEmptyState = () => {
    if (isLoadingContacts) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.emptyStateText}>Loading contacts...</Text>
        </View>
      );
    }

    if (searchQuery.trim()) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateEmoji}>🔍</Text>
          <Text style={styles.emptyStateTitle}>No results found</Text>
          <Text style={styles.emptyStateText}>
            Try a different search term
          </Text>
        </View>
      );
    }

    if (contactsError) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateEmoji}>⚠️</Text>
          <Text style={styles.emptyStateTitle}>Couldn't load contacts</Text>
          <Text style={styles.emptyStateText}>{contactsError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchAllContacts}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateEmoji}>👥</Text>
        <Text style={styles.emptyStateTitle}>No Tap2 contacts</Text>
        <Text style={styles.emptyStateText}>
          Invite your friends to join Tap2 Wallet!
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Contacts List */}
      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          renderItem={renderContactItem}
          keyExtractor={(item) => item.recordID}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[
            styles.listContent,
            filteredContacts.length === 0 && styles.listContentEmpty,
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  clearIcon: {
    fontSize: 18,
    color: '#999999',
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    textTransform: 'uppercase',
  },
  recentList: {
    marginBottom: 8,
  },
  recentListContent: {
    paddingHorizontal: 16,
  },
  recentItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  recentAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  recentAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666666',
  },
  recentName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333333',
    maxWidth: 70,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 16,
  },
  listContentEmpty: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 24,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
