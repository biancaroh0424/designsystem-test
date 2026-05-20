import React from 'react';
import styles from './googlemeet.module.css';

interface googlemeetProps {
  className?: string;
  onClick?: () => void;
}

/**
 * google meet
 * Auto-generated from Figma. Polish as needed.
 * @figma 32×32
 */
export const googlemeet: React.FC<googlemeetProps> = ({}: googlemeetProps) => {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      onClick={onClick}
      data-component="google meet"
    >
      {/* TODO: implement google meet */}
    </div>
  );
};

export default googlemeet;
