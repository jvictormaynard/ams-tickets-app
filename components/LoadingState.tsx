'use client';

import React from 'react';
import '../styles/loading-state.css';

interface LoadingStateProps {
  isLoading?: boolean;
}

export default function LoadingState({ isLoading = true }: LoadingStateProps) {
  if (!isLoading) return null;
  
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loading-spinner" />
      </div>
    </div>
  );
}
