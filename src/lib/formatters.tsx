export function formatCurrency(amount: number): string {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  });
}

function truncate(value: number, decimals: number): string {
  const factor = Math.pow(10, decimals);
  const truncated = Math.floor(value * factor) / factor;
  return truncated.toFixed(decimals);
}

export function formatCompactCurrency(amount: number): string {
  const abs = Math.abs(Number(amount || 0));
  const sign = amount < 0 ? '-' : '';

  if (abs >= 10000000) {
    // Crore
    return `${sign}₹${truncate(abs / 10000000, 2)}Cr`;
  }

  if (abs >= 100000) {
    // Lakh
    return `${sign}₹${truncate(abs / 100000, 2)}L`;
  }

  if (abs >= 1000) {
    // Thousand
    return `${sign}₹${truncate(abs / 1000, 2)}K`;
  }

  return `${sign}₹${abs.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
}