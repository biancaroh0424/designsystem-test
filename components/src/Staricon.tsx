import React from 'react';
import styles from './Staricon.module.css';

interface StariconProps {
  fill?: '0%' | '10%' | '20%' | '30%' | '40%' | '50%' | '60%' | '70%' | '80%' | '90%' | '100%';
  className?: string;
  onClick?: () => void;
}

/**
 * Star icon
 * Auto-generated from Figma. Polish as needed.
 * @figma 412×52
 */
export const Staricon: React.FC<StariconProps> = ({
    fill = '0%',
  className,
  onClick,
}: StariconProps) => {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      onClick={onClick}
      data-component="Star icon"
    >
      {/* TODO: implement Star icon */}
    </div>
  );
};

export default Staricon;
