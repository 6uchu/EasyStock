import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Search, X } from 'lucide-react';
import type { Market, Position } from '../../types/portfolio';
import { lookupInstrument, searchInstruments } from '../../api/portfolio';
import type { InstrumentSearchResult } from '../../api/portfolio';
import { nativeMoney } from '../../utils/formatters';

export type AddPositionInput = { code: string; name: string; market: Market; currency: 'KRW' | 'USD'; currentPrice: number; targetWeight: number };

export function AddStockModal({ profileId, positions, onClose, onAdd }: { profileId: string; positions: Position[]; onClose: () => void; onAdd: (position: AddPositionInput) => void }) {
  const [market, setMarket] = useState<Market>('KR');
  const [code, setCode] = useState('');
  const [instrument, setInstrument] = useState<InstrumentSearchResult | null>(null);
  const [suggestions, setSuggestions] = useState<InstrumentSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [name, setName] = useState('');
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [accountPosition, setAccountPosition] = useState<Position | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const query = code.trim();
    if (!showSuggestions || !query) { setSuggestions([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchInstruments(market, query)
        .then((results) => { if (!cancelled) { setSuggestions(results); setSearchError(''); } })
        .catch((reason) => { if (!cancelled) { setSuggestions([]); setSearchError(reason instanceof Error ? reason.message : '종목 검색에 실패했습니다.'); } })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [code, market, showSuggestions]);

  const chooseInstrument = async (result: InstrumentSearchResult) => {
    const alreadyPlanned = positions.some((position) => position.is_planned && (position.market ?? 'KR') === result.market && position.code === result.code);
    if (alreadyPlanned) {
      setInstrument(result);
      setCode(result.code);
      setName(result.name);
      setAccountPosition(null);
      setCurrentPrice(null);
      setShowSuggestions(false);
      setSuggestions([]);
      setError('이미 포트폴리오에 추가된 종목입니다. 기존 행에서 목표 비중을 수정해 주세요.');
      return;
    }
    setInstrument(result);
    const held = positions.find((position) => !position.is_planned && (position.market ?? 'KR') === result.market && position.code === result.code) ?? null;
    setAccountPosition(held);
    setCode(result.code);
    setName(result.name);
    setCurrentPrice(held ? (held.current_price_native ?? held.current_price) : result.price_hint > 0 ? result.price_hint : null);
    setShowSuggestions(false);
    setSuggestions([]);
    setError('');
    if (held) return;

    setLoadingQuote(true);
    try {
      const quote = await lookupInstrument(profileId, result.market, result.code);
      const integerPrice = Math.round(quote.price);
      setInstrument((current) => current && current.code === result.code && current.market === result.market ? { ...current, currency: quote.currency } : current);
      setName(quote.name || result.name);
      setCurrentPrice(integerPrice);
    } catch {
      if (result.price_hint <= 0) setError('현재가를 조회하지 못해 이 종목을 추가할 수 없습니다. NH 연결과 종목 시세 지원을 확인해 주세요.');
      else setError('시세 조회에 실패해 종목 마스터 기준가를 사용합니다.');
    } finally {
      setLoadingQuote(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const targetWeight = Number(target || 0);
    const normalizedCode = code.trim().toUpperCase();
    if (!instrument || instrument.market !== market || instrument.code !== normalizedCode) {
      setError('연관 검색 결과에서 종목을 선택해 주세요.');
      return;
    }
    if (!name.trim() || !Number.isInteger(currentPrice) || (currentPrice ?? 0) <= 0 || !Number.isFinite(targetWeight) || targetWeight < 0 || targetWeight > 100) {
      setError('현재가를 입력하고 목표 비중을 0~100%로 입력해 주세요.');
      return;
    }
    onAdd({ code: instrument.code, name: name.trim(), market, currency: instrument.currency, currentPrice: currentPrice!, targetWeight });
  };

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal add-stock-modal" onSubmit={submit}>
    <button type="button" className="close-button" aria-label="닫기" onClick={onClose}><X size={19}/></button>
    <span className="eyebrow">PORTFOLIO PLANNING</span><h2>종목 추가</h2><p className="modal-desc">코드나 종목명 일부를 입력해 종목을 찾고 목표 비중만 입력하세요. 수량과 가격은 계좌 잔고에서 가져옵니다.</p>
    <div className="stock-form-grid">
      <label>시장<select value={market} onChange={(e) => { setMarket(e.target.value as Market); setCode(''); setInstrument(null); setAccountPosition(null); setCurrentPrice(null); setSuggestions([]); setShowSuggestions(true); setName(''); setError(''); setSearchError(''); }}><option value="KR">국장 · KRX/NXT</option><option value="US">미장 · 미국</option></select></label>
      <div className="lookup-field"><label htmlFor="instrument-code">{market === 'KR' ? '종목코드 또는 종목명' : '티커 또는 종목명'}</label><div className="lookup-input"><Search size={15}/><input id="instrument-code" value={code} onFocus={() => setShowSuggestions(true)} onChange={(e) => { const next = market === 'US' ? e.target.value.toUpperCase() : e.target.value; setCode(next); setInstrument(null); setAccountPosition(null); setCurrentPrice(null); setSuggestions([]); setShowSuggestions(true); setName(''); setError(''); }} inputMode="text" maxLength={40} placeholder={market === 'KR' ? '005930 또는 삼성전자' : 'AAPL 또는 Apple'} /></div>
        {showSuggestions && code.trim() && <div className="instrument-suggestions">{searching ? <div className="suggestion-message">종목 검색 중…</div> : suggestions.length ? suggestions.map((result) => { const duplicate = positions.some((position) => position.is_planned && (position.market ?? 'KR') === result.market && position.code === result.code); return <button type="button" key={`${result.market}:${result.code}`} className="instrument-suggestion" disabled={duplicate} onClick={() => chooseInstrument(result)}><span><b>{result.name}</b>{result.english_name && result.english_name.toLowerCase() !== result.name.toLowerCase() && <small>{result.english_name}</small>}</span><span className="suggestion-meta"><b>{result.code}</b>{result.is_etf && <em>ETF</em>}{duplicate && <em>추가됨</em>}</span></button>; }) : <div className="suggestion-message">{searchError || '일치하는 종목이 없습니다.'}</div>}</div>}
      </div>
      {instrument && <><div className="selected-instrument"><b>{name}</b><span>{instrument.code}{instrument.is_etf ? ' · ETF' : ''}</span>{accountPosition ? <small>계좌 보유 {accountPosition.quantity.toLocaleString('ko-KR')}주 · 평단 {nativeMoney(accountPosition.average_price_native ?? accountPosition.average_price, accountPosition.currency ?? instrument.currency)} · 현재가 {nativeMoney(accountPosition.current_price_native ?? accountPosition.current_price, accountPosition.currency ?? instrument.currency)}</small> : <small>{loadingQuote ? '현재가 조회 중…' : currentPrice ? `계좌 미보유 · 현재가 ${nativeMoney(currentPrice, instrument.currency)} · 평단은 현재가와 동일` : '계좌 미보유 · 현재가를 확인할 수 없습니다.'}</small>}</div>
      <label>목표 비중 (%)<input required type="number" min="0" max="100" step="0.1" value={target} onChange={(e) => { setTarget(e.target.value); setError(''); }} placeholder="예: 15" /></label></>}
    </div>
    {error && <p className="form-error">{error}</p>}
    <button className="secondary-button" type="submit" disabled={!instrument || loadingQuote || (!accountPosition && (currentPrice === null || currentPrice <= 0))}>포트폴리오에 추가</button>
  </form></div>;
}
