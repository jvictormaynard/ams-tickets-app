import React from 'react';
import '../styles/loading-state.css'; // Assuming a CSS file for styling

const LoadingState: React.FC = () => {
  return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Loading messages...</p>
    </div>
  );
};

export default LoadingState;
