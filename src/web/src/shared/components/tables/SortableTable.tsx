import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import DataTable, { Column } from './DataTable';
import { NEUTRAL_COLORS } from '../../styles/colors';

// Version comments for external dependencies
// react@18.0.0
// styled-components@5.3.0

// Types and Interfaces
export interface SortConfig {
  columnId: string;
  direction: 'asc' | 'desc';
}

export interface SortableColumn extends Column {
  sortFn?: (a: any, b: any) => number;
  sortable?: boolean;
}

export interface SortableTableProps {
  columns: SortableColumn[];
  data: any[];
  defaultSort?: SortConfig[];
  onSortChange?: (sortConfig: SortConfig[]) => void;
  multiSort?: boolean;
  [key: string]: any; // Allow passthrough of other DataTable props
}

// Constants
const DEFAULT_SORT_DIRECTION = 'asc';
const SORT_ICONS = {
  asc: '▲',
  desc: '▼',
  none: '○',
} as const;

// Styled Components
const SortableHeaderCell = styled.th<{ sortable?: boolean }>`
  cursor: ${({ sortable }) => (sortable ? 'pointer' : 'default')};
  user-select: none;
  position: relative;
  padding-right: 24px !important;

  &:hover {
    background-color: ${({ sortable }) =>
      sortable ? NEUTRAL_COLORS.gray200 : 'inherit'};
  }
`;

const SortIndicator = styled.span<{ active?: boolean }>`
  position: absolute;
  right: 8px;
  opacity: ${({ active }) => (active ? 1 : 0.5)};
  font-size: 12px;
`;

const SortIndex = styled.span`
  position: absolute;
  right: 24px;
  font-size: 10px;
  color: ${NEUTRAL_COLORS.gray300};
`;

// Helper Functions
const getSortedData = (
  data: any[],
  sortConfig: SortConfig[],
  columns: SortableColumn[]
): any[] => {
  if (!sortConfig.length) return data;

  return [...data].sort((a, b) => {
    for (const { columnId, direction } of sortConfig) {
      const column = columns.find((col) => col.id === columnId);
      if (!column) continue;

      let comparison = 0;

      if (column.sortFn) {
        comparison = column.sortFn(a, b);
      } else {
        const aValue = typeof column.accessor === 'function' 
          ? column.accessor(a) 
          : a[column.accessor];
        const bValue = typeof column.accessor === 'function'
          ? column.accessor(b)
          : b[column.accessor];

        // Handle null/undefined values
        if (aValue == null && bValue == null) comparison = 0;
        else if (aValue == null) comparison = 1;
        else if (bValue == null) comparison = -1;
        else {
          comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        }
      }

      if (comparison !== 0) {
        return direction === 'asc' ? comparison : -comparison;
      }
    }
    return 0;
  });
};

// Main Component
export const SortableTable: React.FC<SortableTableProps> = ({
  columns,
  data,
  defaultSort = [],
  onSortChange,
  multiSort = false,
  ...restProps
}) => {
  const [sortConfig, setSortConfig] = useState<SortConfig[]>(defaultSort);

  // Memoize sorted data
  const sortedData = useMemo(
    () => getSortedData(data, sortConfig, columns),
    [data, sortConfig, columns]
  );

  const handleHeaderClick = useCallback(
    (columnId: string, event: React.MouseEvent) => {
      const column = columns.find((col) => col.id === columnId);
      if (!column?.sortable) return;

      const newSortConfig = [...sortConfig];
      const existingSortIndex = newSortConfig.findIndex(
        (config) => config.columnId === columnId
      );

      if (existingSortIndex > -1) {
        const currentDirection = newSortConfig[existingSortIndex].direction;
        if (currentDirection === 'desc') {
          newSortConfig.splice(existingSortIndex, 1);
        } else {
          newSortConfig[existingSortIndex].direction = 'desc';
        }
      } else {
        const newSort: SortConfig = {
          columnId,
          direction: DEFAULT_SORT_DIRECTION,
        };

        if (multiSort && event.shiftKey) {
          newSortConfig.push(newSort);
        } else {
          newSortConfig.splice(0, newSortConfig.length, newSort);
        }
      }

      setSortConfig(newSortConfig);
      onSortChange?.(newSortConfig);
    },
    [sortConfig, columns, multiSort, onSortChange]
  );

  // Enhance columns with sort functionality
  const enhancedColumns = useMemo(() => {
    return columns.map((column) => ({
      ...column,
      header: (
        <SortableHeaderCell
          sortable={column.sortable}
          onClick={(e) => handleHeaderClick(column.id, e)}
          role="columnheader"
          aria-sort={
            sortConfig.find((config) => config.columnId === column.id)
              ?.direction || 'none'
          }
        >
          {column.header}
          {column.sortable && (
            <>
              <SortIndicator
                active={sortConfig.some(
                  (config) => config.columnId === column.id
                )}
              >
                {sortConfig.find((config) => config.columnId === column.id)
                  ?.direction === 'desc'
                  ? SORT_ICONS.desc
                  : sortConfig.find((config) => config.columnId === column.id)
                  ? SORT_ICONS.asc
                  : SORT_ICONS.none}
              </SortIndicator>
              {multiSort && (
                <SortIndex>
                  {sortConfig.findIndex(
                    (config) => config.columnId === column.id
                  ) + 1 || ''}
                </SortIndex>
              )}
            </>
          )}
        </SortableHeaderCell>
      ),
    }));
  }, [columns, sortConfig, handleHeaderClick, multiSort]);

  return (
    <DataTable
      {...restProps}
      columns={enhancedColumns}
      data={sortedData}
      aria-sort="true"
      role="grid"
    />
  );
};

export default SortableTable;