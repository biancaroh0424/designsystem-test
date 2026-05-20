import React from 'react';
import styles from './alert-triangle.module.css';

interface alert-triangleProps {
  className?: string;
  onClick?: () => void;
}

/**
 * alert-triangle
 * Auto-generated from Figma. Polish as needed.
 * @figma 24×24
 */
export const alert-triangle: React.FC<alert-triangleProps> = ({}: alert-triangleProps) => {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      onClick={onClick}
      data-component="alert-triangle"
    >
      {/* TODO: implement alert-triangle */}
    </div>
  );
};

export default alert-triangle;
