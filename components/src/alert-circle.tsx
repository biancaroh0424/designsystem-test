import React from 'react';
import styles from './alert-circle.module.css';

interface alert-circleProps {
  className?: string;
  onClick?: () => void;
}

/**
 * alert-circle
 * Auto-generated from Figma. Polish as needed.
 * @figma 24×24
 */
export const alert-circle: React.FC<alert-circleProps> = ({}: alert-circleProps) => {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      onClick={onClick}
      data-component="alert-circle"
    >
      {/* TODO: implement alert-circle */}
    </div>
  );
};

export default alert-circle;
