/**
 * Calculate the number of days between deal creation and close
 */
export function calculateConversionDays(dealProperties: Record<string, any>): number {
  const createDate = dealProperties.createdate ? new Date(dealProperties.createdate) : null;
  const closeDate = dealProperties.closedate ? new Date(dealProperties.closedate) : null;

  if (!createDate || !closeDate) {
    return 0;
  }

  const diffTime = Math.abs(closeDate.getTime() - createDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate statistics for an array of deal amounts
 * @param amounts Array of deal amounts
 * @returns Object containing low, high, median, and count statistics
 */
export function calculateDealStatistics(amounts: number[]): {
  low: number;
  high: number;
  median: number;
  count: number;
} {
  if (!amounts || amounts.length === 0) {
    return {
      low: 0,
      high: 0,
      median: 0,
      count: 0
    };
  }

  const sortedAmounts = [...amounts].sort((a, b) => a - b);
  const count = sortedAmounts.length;
  
  return {
    low: sortedAmounts[0],
    high: sortedAmounts[count - 1],
    median: count % 2 === 0
      ? (sortedAmounts[count / 2 - 1] + sortedAmounts[count / 2]) / 2
      : sortedAmounts[Math.floor(count / 2)],
    count
  };
} 