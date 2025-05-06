/**
 * Normalizes capability and skill levels to numeric values for comparison
 * @param level The level string to normalize
 * @returns A numeric value from 0-5 representing the level
 */
export function getLevelValue(level: string): number {
  const levelMap: { [key: string]: number } = {
    'basic': 1,
    'foundation': 1,
    'beginner': 1,
    'intermediate': 2,
    'proficient': 3,
    'advanced': 4,
    'expert': 5,
    'leadership': 5,
    'master': 5
  }
  return levelMap[level.toLowerCase()] || 0
} 