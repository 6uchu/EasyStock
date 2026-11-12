import type { Position } from '../types/portfolio';

export function calculateShareChange(position: Position, budget: number): number {
  const price = position.current_price;
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(budget)) return 0;

  const targetValue = budget * position.target_weight / 100;
  const currentValue = position.quantity * price;
  const difference = targetValue - currentValue;

  if (difference > 0) return Math.floor(difference / price);
  if (difference < 0) return -Math.ceil(Math.abs(difference) / price);
  return 0;
}
