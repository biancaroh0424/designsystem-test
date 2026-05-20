import React from 'react';
import styles from './check-circle.module.css';

interface check-circleProps {
  className?: string;
  onClick?: () => void;
}

/**
 * check-circle
 * Auto-generated from Figma. Polish as needed.
 * @figma 24×24
 */
export const check-circle: React.FC<check-circleProps> = ({}: check-circleProps) => {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      onClick={onClick}
      data-component="check-circle"
    >
      {/* TODO: implement check-circle */}
    </div>
  );
};

export default check-circle;
