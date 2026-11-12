export type Market = 'KR' | 'US';
export type Position = { code: string; name: string; target_weight: number; quantity: number; current_price: number; average_price: number; is_planned?: boolean; is_in_portfolio?: boolean; market?: Market; currency?: 'KRW' | 'USD'; fx_rate?: number; current_price_native?: number; average_price_native?: number };
export type Portfolio = { cash: number; positions: Position[]; currency: string };
export type PortfolioAccount = { account_no: string; account_type: string };
export type Connection = { id: string; broker_id: string; broker_name: string; label: string };
export type BacktestPosition = { code: string; name: string; market: Market; target_weight: number };
export type BacktestInput = { start_date: string; mode: 'once' | 'recurring'; frequency: 'weekly' | 'monthly'; investment_amount?: number; positions: BacktestPosition[] };
export type BacktestResult = { mode: 'once' | 'recurring'; frequency: 'weekly' | 'monthly' | null; start_date: string; end_date: string; return_pct: number | null; investment_amount?: number | null; current_value?: number | null; profit_amount?: number | null; index_series: Array<{ date: string; value: number }>; positions: Array<{ code: string; name: string; market: Market; available_from_date: string; buy_count: number; first_buy_date: string | null; last_buy_date: string | null; average_buy_price: number | null; latest_price: number; return_pct: number | null; invested_amount?: number | null; current_value?: number | null; profit_amount?: number | null }> };
