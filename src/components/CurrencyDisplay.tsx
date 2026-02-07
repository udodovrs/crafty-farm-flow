import { Coins } from "lucide-react";

interface CurrencyDisplayProps {
  amount: number;
  size?: "sm" | "md" | "lg";
}

const CurrencyDisplay = ({ amount, size = "md" }: CurrencyDisplayProps) => {
  const sizeClasses = {
    sm: "text-sm gap-1",
    md: "text-base gap-1.5",
    lg: "text-xl gap-2 font-bold",
  };

  const iconSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <span className={`inline-flex items-center text-craft-gold font-display ${sizeClasses[size]}`}>
      <Coins className={iconSizes[size]} />
      {amount}
    </span>
  );
};

export default CurrencyDisplay;
