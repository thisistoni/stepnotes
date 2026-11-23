import { EmptyState, Icon } from '@/components/ui';
import { colors } from '@/lib/theme';

/** Search / filter produced nothing. */
export function NoMatches({ query, styleLabel, onClear }: { query: string; styleLabel: string | null; onClear: () => void }) {
  const q = query.trim();
  const title = q ? `No dances match “${q}”` : `No ${styleLabel ?? ''} dances yet`.replace('  ', ' ');
  const body = q
    ? styleLabel
      ? `Nothing in ${styleLabel} matches. Try another word or show all styles.`
      : 'Try another name or style.'
    : 'Pick another style, or create one in this style.';
  return (
    <EmptyState
      art={<Icon name="search" size={40} color={colors.ink3} strokeWidth={2.4} />}
      title={title}
      body={body}
      action={{ label: q ? 'Clear search' : 'Show all dances', variant: 'secondary', onPress: onClear, testID: 'clear-search' }}
    />
  );
}
