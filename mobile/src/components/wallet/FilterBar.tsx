import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';

export type TransactionFilter = 'all' | 'payment' | 'p2p' | 'fund' | 'withdraw';

export interface FilterOption {
  label: string;
  value: TransactionFilter;
  count?: number;
}

export interface FilterBarProps {
  filters: FilterOption[];
  selectedFilter: TransactionFilter;
  onFilterChange: (filter: TransactionFilter) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  selectedFilter,
  onFilterChange,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {filters.map((filter) => {
          const isSelected = selectedFilter === filter.value;

          return (
            <Pressable
              key={filter.value}
              onPress={() => onFilterChange(filter.value)}
              style={({ pressed }) => [
                styles.filter,
                isSelected && styles.selectedFilter,
                pressed && styles.pressedFilter,
              ]}
            >
              <Text
                style={[
                  styles.filterLabel,
                  isSelected && styles.selectedFilterLabel,
                ]}
              >
                {filter.label}
              </Text>
              {filter.count !== undefined && (
                <Text
                  style={[
                    styles.filterCount,
                    isSelected && styles.selectedFilterCount,
                  ]}
                >
                  {filter.count > 99 ? '99+' : filter.count}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  selectedFilter: {
    backgroundColor: '#007AFF',
  },
  pressedFilter: {
    opacity: 0.8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  selectedFilterLabel: {
    color: '#FFFFFF',
  },
  filterCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
    marginLeft: 6,
  },
  selectedFilterCount: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
});
