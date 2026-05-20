import React from 'react';
import styles from './Cursor.module.css';

interface CursorProps {
  state?: 'Arrow' | 'Drag' | 'Hand';
  className?: string;
  onClick?: () => void;
}

/**
 * Cursor
 * Auto-generated from Figma. Polish as needed.
 * @figma 108×52
 */
export const Cursor: React.FC<CursorProps> = ({
    state = 'Arrow',
  className,
  onClick,
}: CursorProps) => {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      onClick={onClick}
      data-component="Cursor"
    >
      {/* TODO: implement Cursor */}
    </div>
  );
};

export default Cursor;
