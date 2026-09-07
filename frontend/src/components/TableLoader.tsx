import React from 'react';

interface TableLoaderProps {
  colSpan: number;
  label?: string;
}

export const TableLoader: React.FC<TableLoaderProps> = ({ colSpan, label = 'Loading data...' }) => (
  <tr>
    <td colSpan={colSpan}>
      <div className="table-loader" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </td>
  </tr>
);
