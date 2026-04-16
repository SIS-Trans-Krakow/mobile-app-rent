import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { CompanyItem } from '../types/company';

interface CompanyLookupProps {
  label: string;
  placeholder: string;
  searchQuery: string;
  searchLoading: boolean;
  showResults: boolean;
  selectedCompany: CompanyItem | null;
  searchResults: CompanyItem[];
  searchingText: string;
  noResultsText: string;
  selectedText: string;
  onChangeText: (text: string) => void;
  onSelectCompany: (company: CompanyItem) => void;
  onClearSelection: () => void;
}

export default function CompanyLookup({
  label,
  placeholder,
  searchQuery,
  searchLoading,
  showResults,
  selectedCompany,
  searchResults,
  searchingText,
  noResultsText,
  selectedText,
  onChangeText,
  onSelectCompany,
  onClearSelection,
}: CompanyLookupProps) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputRow}>
          <Ionicons name="search" size={18} color={Colors.gray400} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={Colors.gray400}
          />
          {searchLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} style={styles.searchSpinner} />
          ) : null}
          {selectedCompany ? (
            <TouchableOpacity
              onPress={onClearSelection}
              style={styles.clearBtn}
              accessibilityRole="button"
              accessible
            >
              <Ionicons name="close-circle" size={20} color={Colors.gray400} />
            </TouchableOpacity>
          ) : null}
        </View>

        {showResults && !selectedCompany ? (
          <View style={styles.resultsDropdown}>
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {searchLoading ? (
                <View style={styles.resultItem}>
                  <Text style={styles.resultHint}>{searchingText}</Text>
                </View>
              ) : searchResults.length > 0 ? (
                searchResults.map((company) => {
                  const subtitle = [company.tax_id ? `NIP: ${company.tax_id}` : '', company.contact_person]
                    .filter(Boolean)
                    .join(' · ');
                  const address = [company.address_line1 || company.address, company.address_line2, company.postal_code]
                    .filter(Boolean)
                    .join(', ');

                  return (
                    <TouchableOpacity
                      key={company.id}
                      style={styles.resultItem}
                      onPress={() => onSelectCompany(company)}
                      accessibilityRole="button"
                      accessible
                      accessibilityLabel={company.name}
                    >
                      <Text style={styles.resultName}>{company.name}</Text>
                      {subtitle ? <Text style={styles.resultMeta}>{subtitle}</Text> : null}
                      {address ? <Text style={styles.resultAddress}>{address}</Text> : null}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.resultItem}>
                  <Text style={styles.resultHint}>{noResultsText}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {selectedCompany ? (
        <View style={styles.selectedBadge}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <Text style={styles.selectedBadgeText}>{selectedText}</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.gray700,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  searchContainer: { position: 'relative', zIndex: 20 },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    zIndex: 20,
  },
  searchIcon: { marginRight: Spacing.xs },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  searchSpinner: { marginLeft: Spacing.xs },
  clearBtn: { padding: Spacing.xs },
  resultsDropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: BorderRadius.sm,
    borderBottomRightRadius: BorderRadius.sm,
    maxHeight: 240,
    zIndex: 100,
    elevation: 8,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  resultItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  resultName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  resultMeta: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  resultAddress: {
    fontSize: FontSize.xs,
    color: Colors.gray400,
    marginTop: 2,
  },
  resultHint: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: '#ecfdf5',
    borderRadius: BorderRadius.sm,
  },
  selectedBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '600',
  },
});
