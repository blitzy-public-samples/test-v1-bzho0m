import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import { NEUTRAL_COLORS } from '../../styles/colors';
import { useVirtualization } from './hooks/useVirtualization';
import { useSortableData } from './hooks/useSortableData';
import { useTableKeyboardNavigation } from './hooks/useTableKeyboardNavigation';

// Constants
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_EMPTY_MESSAGE = 'No data available';
const VIRTUAL_ROW_HEIGHT = 48;
const SCROLL_THRESHOLD = 0.8;
const MOBILE_BREAKPOINT = 576;
const TABLET_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 992;

// Interfaces
export interface Column {
  id: string;
  header: string;
  accessor: string | ((row: any) => any);
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterType?: 'text' | 'select' | 'date' | 'number';
  Cell?: (value: any, row: any) => React.ReactNode;
  cellRenderer?: (props: CellRendererProps) => React.ReactNode;
  sticky?: boolean;
}

export interface DataTableProps {
  columns: Column[];
  data: any[];
  loading?: boolean;
  emptyMessage?: string;
  rowKey: string | ((row: any) => string);
  onRowClick?: (row: any) => void;
  selectedRows?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  pageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  sortable?: boolean;
  defaultSortColumn?: string;
  defaultSortDirection?: 'asc' | 'desc';
  virtualScroll?: boolean;
  rowHeight?: number;
  stickyHeader?: boolean;
  responsive?: boolean;
  'aria-label'?: string;
  role?: string;
}

interface CellRendererProps {
  value: any;
  row: any;
  column: Column;
  isSelected: boolean;
}

// Styled Components
const TableContainer = styled.div<{ responsive?: boolean }>`
  width: 100%;
  overflow-x: auto;
  background-color: ${NEUTRAL_COLORS.white};
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  position: relative;

  @media (max-width: ${MOBILE_BREAKPOINT}px) {
    overflow-x: scroll;
    -webkit-overflow-scrolling: touch;
  }
`;

const Table = styled.table<{ stickyHeader?: boolean }>`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;

  ${({ stickyHeader }) =>
    stickyHeader &&
    css`
      thead th {
        position: sticky;
        top: 0;
        background: ${NEUTRAL_COLORS.white};
        z-index: 1;
      }
    `}
`;

const Th = styled.th<{ align?: string; width?: string; sortable?: boolean }>`
  padding: 12px 16px;
  text-align: ${({ align }) => align || 'left'};
  font-weight: 600;
  border-bottom: 2px solid ${NEUTRAL_COLORS.gray200};
  white-space: nowrap;
  ${({ width }) => width && `width: ${width};`}
  ${({ sortable }) =>
    sortable &&
    css`
      cursor: pointer;
      user-select: none;
      &:hover {
        background-color: ${NEUTRAL_COLORS.gray100};
      }
    `}
`;

const Td = styled.td<{ align?: string }>`
  padding: 12px 16px;
  text-align: ${({ align }) => align || 'left'};
  border-bottom: 1px solid ${NEUTRAL_COLORS.gray300};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Tr = styled.tr<{ isSelected?: boolean }>`
  &:hover {
    background-color: ${NEUTRAL_COLORS.gray100};
  }
  ${({ isSelected }) =>
    isSelected &&
    css`
      background-color: ${NEUTRAL_COLORS.gray200};
    `}
`;

const EmptyMessage = styled.div`
  padding: 24px;
  text-align: center;
  color: ${NEUTRAL_COLORS.gray500};
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
`;

// Main Component
export const DataTable: React.FC<DataTableProps> = memo(({
  columns,
  data,
  loading = false,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  rowKey,
  onRowClick,
  selectedRows = [],
  onSelectionChange,
  pageSize = DEFAULT_PAGE_SIZE,
  currentPage = 1,
  onPageChange,
  sortable = true,
  defaultSortColumn,
  defaultSortDirection = 'asc',
  virtualScroll = false,
  rowHeight = VIRTUAL_ROW_HEIGHT,
  stickyHeader = false,
  responsive = true,
  'aria-label': ariaLabel,
  role = 'grid',
}) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const [sortConfig, setSortConfig] = useState({
    key: defaultSortColumn,
    direction: defaultSortDirection,
  });

  // Custom hooks
  const { sortedData, requestSort } = useSortableData(data, sortConfig);
  const { virtualItems, totalHeight } = useVirtualization({
    items: sortedData,
    height: tableRef.current?.clientHeight || 0,
    rowHeight,
    enabled: virtualScroll,
  });
  const { focusedCell, handleKeyDown } = useTableKeyboardNavigation({
    rowCount: data.length,
    columnCount: columns.length,
  });

  // Handlers
  const handleHeaderClick = useCallback(
    (column: Column) => {
      if (sortable && column.sortable !== false) {
        requestSort(column.id);
      }
    },
    [sortable, requestSort]
  );

  const getRowKey = useCallback(
    (row: any): string => {
      return typeof rowKey === 'function' ? rowKey(row) : row[rowKey];
    },
    [rowKey]
  );

  const handleRowSelection = useCallback(
    (row: any) => {
      if (!onSelectionChange) return;
      const rowId = getRowKey(row);
      const newSelection = selectedRows.includes(rowId)
        ? selectedRows.filter(id => id !== rowId)
        : [...selectedRows, rowId];
      onSelectionChange(newSelection);
    },
    [selectedRows, onSelectionChange, getRowKey]
  );

  // Render helpers
  const renderCell = useCallback(
    (row: any, column: Column) => {
      const value = typeof column.accessor === 'function'
        ? column.accessor(row)
        : row[column.accessor];

      if (column.cellRenderer) {
        return column.cellRenderer({
          value,
          row,
          column,
          isSelected: selectedRows.includes(getRowKey(row)),
        });
      }

      if (column.Cell) {
        return column.Cell(value, row);
      }

      return value;
    },
    [getRowKey, selectedRows]
  );

  const renderRows = useMemo(() => {
    const rows = virtualScroll ? virtualItems : sortedData;
    return rows.map((row: any, rowIndex: number) => {
      const rowId = getRowKey(row);
      const isSelected = selectedRows.includes(rowId);

      return (
        <Tr
          key={rowId}
          isSelected={isSelected}
          onClick={() => {
            onRowClick?.(row);
            handleRowSelection(row);
          }}
          role="row"
          aria-selected={isSelected}
          tabIndex={0}
        >
          {columns.map((column, colIndex) => (
            <Td
              key={column.id}
              align={column.align}
              role="gridcell"
              aria-colindex={colIndex + 1}
              aria-selected={focusedCell?.row === rowIndex && focusedCell?.col === colIndex}
            >
              {renderCell(row, column)}
            </Td>
          ))}
        </Tr>
      );
    });
  }, [
    virtualItems,
    sortedData,
    columns,
    virtualScroll,
    selectedRows,
    onRowClick,
    handleRowSelection,
    renderCell,
    getRowKey,
    focusedCell,
  ]);

  return (
    <TableContainer
      ref={tableRef}
      responsive={responsive}
      role={role}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    >
      <Table stickyHeader={stickyHeader}>
        <thead>
          <tr role="row">
            {columns.map((column, index) => (
              <Th
                key={column.id}
                align={column.align}
                width={column.width}
                sortable={sortable && column.sortable !== false}
                onClick={() => handleHeaderClick(column)}
                role="columnheader"
                aria-sort={
                  sortConfig.key === column.id
                    ? sortConfig.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                aria-colindex={index + 1}
              >
                {column.header}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup" style={virtualScroll ? { height: totalHeight } : undefined}>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyMessage>{emptyMessage}</EmptyMessage>
              </td>
            </tr>
          ) : (
            renderRows
          )}
        </tbody>
      </Table>
      {loading && (
        <LoadingOverlay role="alert" aria-busy="true">
          Loading...
        </LoadingOverlay>
      )}
    </TableContainer>
  );
});

DataTable.displayName = 'DataTable';

export default DataTable;