export const formatCurrency = (value: number | null | undefined): string => {
  const amount = Number(value) || 0;
  return `LKR ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};
