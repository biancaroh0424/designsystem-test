import React from 'react';
import styles from './Socialicon.module.css';

interface SocialiconProps {
  platform?: 'Apple' | 'Clubhouse' | 'Discord' | 'Dribbble' | 'Facebook' | 'Figma' | 'Google' | 'Instagram' | 'LinkedIn' | 'Pinterest' | 'GitHub' | 'Reddit' | 'Signal' | 'Snapchat' | 'Telegram' | 'TikTok' | 'Tumblr' | 'X (Twitter)' | 'YouTube' | 'AngelList' | 'Layers';
  state?: 'Default' | 'Hover';
  style?: 'Brand' | 'Gray' | 'White';
  className?: string;
  onClick?: () => void;
}

/**
 * Social icon
 * Auto-generated from Figma. Polish as needed.
 * @figma 456×544
 */
export const Socialicon: React.FC<SocialiconProps> = ({
    platform = 'Apple',
    state = 'Default',
    style = 'Brand',
  className,
  onClick,
}: SocialiconProps) => {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      onClick={onClick}
      data-component="Social icon"
    >
      {/* TODO: implement Social icon */}
    </div>
  );
};

export default Socialicon;
