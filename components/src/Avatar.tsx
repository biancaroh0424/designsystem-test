import React from 'react';
import styles from './Avatar.module.css';

interface AvatarProps {
  className?: string;
  onClick?: () => void;
}

/**
 * Avatar
 * Auto-generated from Figma. Polish as needed.
 * @figma 32×32
 */
export const Avatar: React.FC<AvatarProps> = ({}: AvatarProps) => {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      onClick={onClick}
      data-component="Avatar"
    >
      {/* TODO: implement Avatar */}
    </div>
  );
};

export default Avatar;
