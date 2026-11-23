import { EmptyState, Icon } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors } from '@/lib/theme';

/** Search / filter produced nothing. */
export function NoMatches({ query, styleLabel, onClear }: { query: string; styleLabel: string | null; onClear: () => void }) {
  const t = useT();
  const q = query.trim();
  const title = q ? t.library.noMatchQuery(q) : t.library.noMatchStyle(styleLabel ?? '');
  const body = q
    ? styleLabel
      ? t.library.noMatchQueryInStyle(styleLabel)
      : t.library.noMatchQueryBody
    : t.library.noMatchStyleBody;
  return (
    <EmptyState
      art={<Icon name="search" size={40} color={colors.ink3} strokeWidth={2.4} />}
      title={title}
      body={body}
      action={{ label: q ? t.library.clearSearch : t.library.showAll, variant: 'secondary', onPress: onClear, testID: 'clear-search' }}
    />
  );
}
