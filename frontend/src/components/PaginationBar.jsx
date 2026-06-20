import React from 'react';
import './PaginationBar.css';

export default function PaginationBar({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination-container">
      <button 
        className="pagination-btn" 
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        &larr; Previous
      </button>
      
      <span className="pagination-info">
        Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
      </span>

      <button 
        className="pagination-btn" 
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        Next &rarr;
      </button>
    </div>
  );
}
