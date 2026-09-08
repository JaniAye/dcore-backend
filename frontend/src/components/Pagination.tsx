import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) onPageChange(totalPages);
  }, [currentPage, onPageChange, totalPages]);

  if (totalItems <= pageSize) return null;

  return (
    <div className="pagination" aria-label="Table pagination">
      <span className="pagination-summary">
        Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="btn btn-outline pagination-button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="pagination-page">Page {currentPage} of {totalPages}</span>
        <button
          type="button"
          className="btn btn-outline pagination-button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};
