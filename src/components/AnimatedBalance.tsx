import React, { useEffect, useState, useRef } from 'react';

interface AnimatedBalanceProps {
  value: number;
  showBalance?: boolean;
  className?: string;
}

export const AnimatedBalance: React.FC<AnimatedBalanceProps> = ({
  value,
  showBalance = true,
  className = "text-3xl font-extrabold tracking-tight text-[#111111]",
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = displayValue;
    const endValue = value;
    if (startValue === endValue) return;

    setIsUpdating(true);
    const startTime = performance.now();
    const duration = 1200; // 1.2s smooth clock tick transition

    const easeOutQuad = (t: number) => t * (2 - t);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuad(progress);

      const currentValue = startValue + (endValue - startValue) * easedProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setIsUpdating(false);
      }
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [value]);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  if (!showBalance) {
    return <span className={className}>R$ ••••••</span>;
  }

  return (
    <span
      className={`${className} inline-block transition-transform duration-200 ${
        isUpdating ? 'scale-[1.02]' : 'scale-100'
      }`}
    >
      {formatCurrency(displayValue)}
    </span>
  );
};
