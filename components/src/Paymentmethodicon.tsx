import React from 'react';
import styles from './Paymentmethodicon.module.css';

interface PaymentmethodiconProps {
  size?: 'sm' | 'md';
  paymentMethod?: 'AMEX' | 'Affirm' | 'Alipay' | 'Amazon' | 'ApplePay' | 'Bancontact' | 'Bitcoin' | 'BitcoinCash' | 'Bitpay' | 'Citadele' | 'DinersClub' | 'Discover' | 'Elo' | 'Etherium' | 'Forbrugsforeningen' | 'GooglePay' | 'Giropay' | 'Ideal' | 'Interac' | 'JCB' | 'Klarna' | 'Lightcoin' | 'Maestro' | 'Mastercard' | 'PayPal' | 'Payoneer' | 'Paysafe' | 'Qiwi' | 'SEPA' | 'Shop Pay' | 'Skrill' | 'Sofort' | 'Stripe' | 'UnionPay' | 'Verifone' | 'Visa' | 'WeChat' | 'Webmoney' | 'Yandex';
  className?: string;
  onClick?: () => void;
}

/**
 * Payment method icon
 * Auto-generated from Figma. Polish as needed.
 * @figma 320×977
 */
export const Paymentmethodicon: React.FC<PaymentmethodiconProps> = ({
    size = 'sm',
    paymentMethod = 'AMEX',
  className,
  onClick,
}: PaymentmethodiconProps) => {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(' ')}
      onClick={onClick}
      data-component="Payment method icon"
    >
      {/* TODO: implement Payment method icon */}
    </div>
  );
};

export default Paymentmethodicon;
