import React from 'react';
import styles from './Button.module.css';

interface ButtonProps {
  type?: 'destructive' | 'ghost' | 'primary' | 'secondary' | 'iconLeft' | 'iconRight';
  status?: 'Default' | 'disabled';
  className?: string;
  onClick?: () => void;
}

/**
 * Button
 * Auto-generated from Figma. Polish as needed.
 * @figma 814×154
 */
export const Button: React.FC<ButtonProps> = ({
    type = 'destructive',
    status = 'Default',
  className,
  onClick,
}: ButtonProps) => {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      onClick={onClick}
      data-component="Button"
    >
      {/* TODO: implement Button */}
    </div>
  );
};

export default Button;
