import React from 'react';

// Skeleton Props
interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

// Base Skeleton Component
export const Skeleton: React.FC<SkeletonProps> = ({ 
  width = '100%', 
  height = '20px', 
  borderRadius = '4px',
  className = ''
}) => {
  const style: React.CSSProperties = {
    width,
    height,
    borderRadius,
    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  };

  return (
    <div 
      className={`skeleton ${className}`} 
      style={style}
    />
  );
};

// Skeleton Card
export const SkeletonCard: React.FC = () => {
  return (
    <div className="skeleton-card">
      <Skeleton height="16px" width="80%" />
      <Skeleton height="12px" width="60%" />
      <Skeleton height="12px" width="40%" />
    </div>
  );
};

// Skeleton Text
export const SkeletonText: React.FC<{ lines?: number }> = ({ lines = 3 }) => {
  return (
    <div className="skeleton-text">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          height="12px" 
          width={i === lines - 1 ? '70%' : '100%'} 
        />
      ))}
    </div>
  );
};

// Skeleton Avatar
export const SkeletonAvatar: React.FC<{ size?: string }> = ({ size = '40px' }) => {
  return (
    <Skeleton 
      width={size} 
      height={size} 
      borderRadius="50%" 
    />
  );
};

// Skeleton Button
export const SkeletonButton: React.FC = () => {
  return (
    <Skeleton width="100px" height="36px" borderRadius="8px" />
  );
};

// CSS for skeletons
export const skeletonStyles = `
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  
  .skeleton {
    display: block;
  }
  
  .dark-mode .skeleton {
    background: linear-gradient(90deg, #2d3142 25%, #353849 50%, #2d3142 75%);
    backgroundSize: 200% 100%;
  }
  
  .skeleton-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    background: white;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }
  
  .dark-mode .skeleton-card {
    background: #252935;
    border-color: #353945;
  }
  
  .skeleton-text {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
`;

export default Skeleton;
