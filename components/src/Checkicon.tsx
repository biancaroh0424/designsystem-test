import React from 'react';
import styles from './Checkicon.module.css';

interface CheckiconProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  color?: 'Brand' | 'Gray' | 'Success';
  className?: string;
  onClick?: () => void;
}

/**
 * Check icon
 * Auto-generated from Figma. Polish as needed.
 * @figma 292×184
 */
export const Checkicon: React.FC<CheckiconProps> = ({
    size = 'xs',
    color = 'Brand',
  className,
  onClick,
}: CheckiconProps) => {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      onClick={onClick}
      data-component="Check icon"
    >
      {/* TODO: implement Check icon */}
    </div>
  );
};

export default Checkicon;
