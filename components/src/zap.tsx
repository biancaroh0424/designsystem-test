import React from 'react';
import styles from './zap.module.css';

interface zapProps {
  className?: string;
  onClick?: () => void;
}

/**
 * zap
 * Auto-generated from Figma. Polish as needed.
 * @figma 24×24
 */
export const zap: React.FC<zapProps> = ({}: zapProps) => {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      onClick={onClick}
      data-component="zap"
    >
      {/* TODO: implement zap */}
    </div>
  );
};

export default zap;
