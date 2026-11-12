export const money = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;
export const nativeMoney = (n: number, currency: 'KRW' | 'USD') => currency === 'USD' ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : money(n);
export const pct = (n: number, digits = 1) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`;
