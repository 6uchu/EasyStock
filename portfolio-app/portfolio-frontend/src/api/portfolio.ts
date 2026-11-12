import axios from 'axios';
import type { BacktestInput, BacktestResult, Connection, Market, Portfolio, PortfolioAccount } from '../types/portfolio';

export type InstrumentSearchResult = { code: string; name: string; english_name: string; market: Market; currency: 'KRW' | 'USD'; is_etf: boolean; price_hint: number };
export type InstrumentHistoryStart = { code: string; market: Market; available_from_date: string | null };
export type InstrumentHistoryAvailability = { positions: InstrumentHistoryStart[]; all_positions_available_from_date: string | null };

const base = import.meta.env.VITE_API_URL;

function apiBase() {
  if (!base) throw new Error('프런트엔드 .env에 VITE_API_URL을 설정한 뒤 Vite 서버를 다시 시작해 주세요.');
  return base.replace(/\/$/, '');
}

function messageFrom(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (!error.response) return '백엔드에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인해 주세요.';
  }
  return error instanceof Error ? error.message : '계좌 정보를 불러오지 못했습니다.';
}

export async function getConnections(): Promise<Connection[]> {
  try {
    const response = await axios.get<Connection[]>(`${apiBase()}/connections`, { timeout: 10000 });
    return response.data;
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

export async function saveConnection(input: { broker_id: string; label: string; app_key: string; app_secret: string }): Promise<Connection> {
  try {
    const response = await axios.post<Connection>(`${apiBase()}/connections`, input, { timeout: 15000 });
    return response.data;
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

export async function deleteConnection(profileId: string): Promise<void> {
  try {
    await axios.delete(`${apiBase()}/connections/${encodeURIComponent(profileId)}`, { timeout: 10000 });
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

export async function getAccounts(profileId: string): Promise<PortfolioAccount[]> {
  try {
    const response = await axios.get<PortfolioAccount[]>(`${apiBase()}/portfolio/accounts`, {
      params: { profile_id: profileId },
      timeout: 20000,
    });
    return response.data;
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

export async function getPortfolio(profileId: string, accountNo: string): Promise<Portfolio> {
  try {
    const response = await axios.get<Portfolio>(`${apiBase()}/portfolio`, {
      params: { profile_id: profileId, account_no: accountNo },
      timeout: 25000,
    });
    return response.data;
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

export async function lookupInstrument(profileId: string, market: Market, code: string): Promise<{ code: string; name: string; price: number; currency: 'KRW' | 'USD'; market: Market }> {
  try {
    const response = await axios.get(`${apiBase()}/portfolio/instruments/lookup`, { params: { profile_id: profileId, market, code }, timeout: 20000 });
    return response.data;
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

export async function searchInstruments(market: Market, query: string): Promise<InstrumentSearchResult[]> {
  try {
    const response = await axios.get<InstrumentSearchResult[]>(`${apiBase()}/portfolio/instruments/search`, { params: { market, query }, timeout: 25000 });
    return response.data;
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

export async function getInstrumentHistoryStarts(profileId: string, positions: Array<{ code: string; name: string; market: Market; target_weight: number }>): Promise<InstrumentHistoryAvailability> {
  try {
    const response = await axios.post<InstrumentHistoryAvailability>(`${apiBase()}/portfolio/instruments/history-start`, { positions }, {
      params: { profile_id: profileId },
      timeout: 120000,
    });
    return response.data;
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

export async function runBacktest(profileId: string, input: BacktestInput): Promise<BacktestResult> {
  try {
    const response = await axios.post<BacktestResult>(`${apiBase()}/portfolio/backtest`, input, {
      params: { profile_id: profileId },
      timeout: 120000,
    });
    return response.data;
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}
