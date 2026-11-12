import { useEffect, useMemo, useState } from 'react';
import { Pencil, Play, Plus, RotateCw, Search, Trash2, X } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getInstrumentHistoryStarts, runBacktest, searchInstruments } from '../../api/portfolio';
import type { InstrumentSearchResult } from '../../api/portfolio';
import type { BacktestInput, BacktestResult, Market, Position } from '../../types/portfolio';
import { money, nativeMoney, pct } from '../../utils/formatters';
import { BudgetModal } from '../common/BudgetModal';

export type LabPosition = { code: string; name: string; market: Market; target_weight: number; available_from_date?: string; availability_checked?: boolean };
export type ResearchPortfolio = { id: string; name: string; positions: LabPosition[]; all_positions_available_from_date?: string | null; availability_checked?: boolean };
export const RESEARCH_PORTFOLIOS_KEY = 'easystock.research-portfolios.v1';
export const RESEARCH_ACTIVE_KEY = 'easystock.research-active-portfolio.v1';
const PORTFOLIOS_UPDATED_EVENT = 'easystock:research-portfolios-updated';
const investmentAmountKey = (portfolioId: string) => `easystock.research-investment.${portfolioId}`;
const defaultDate = () => { const date = new Date(); date.setFullYear(date.getFullYear() - 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const makePortfolio = (name = '새 포트폴리오'): ResearchPortfolio => ({ id: crypto.randomUUID(), name, positions: [] });
function loadPortfolios(): ResearchPortfolio[] { try { const parsed = JSON.parse(localStorage.getItem(RESEARCH_PORTFOLIOS_KEY) || '[]'); return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.positions)).map((portfolio) => ({ ...portfolio, positions: portfolio.positions.map((position: LabPosition) => ({ ...position, availability_checked: Boolean(position.availability_checked || position.available_from_date) })) })) : []; } catch { return []; } }
function price(value: number, market: Market) { return market === 'US' ? nativeMoney(value, 'USD') : money(value); }
function displayDate(value: string) { const digits = value.replace(/\D/g, ''); return digits.length === 8 ? `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}` : value; }
function loadInvestmentAmount() { const portfolioId = localStorage.getItem(RESEARCH_ACTIVE_KEY); const saved = portfolioId ? Number(localStorage.getItem(investmentAmountKey(portfolioId))) : NaN; return Number.isFinite(saved) && saved >= 0 ? saved : 1_000_000; }

export function ResearchLab({ profileId, dashboardPositions, dashboardLoaded }: { profileId: string; dashboardPositions: Position[]; dashboardLoaded: boolean }) {
  const [portfolios, setPortfolios] = useState<ResearchPortfolio[]>(loadPortfolios);
  const [activeId, setActiveId] = useState(() => localStorage.getItem(RESEARCH_ACTIVE_KEY) || '');
  const activePortfolio = portfolios.find((item) => item.id === activeId) ?? portfolios[0] ?? null;
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [market, setMarket] = useState<Market>('KR');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<InstrumentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [startDate, setStartDate] = useState(defaultDate);
  const [mode, setMode] = useState<BacktestInput['mode']>('once');
  const [frequency, setFrequency] = useState<BacktestInput['frequency']>('monthly');
  const [investmentAmount, setInvestmentAmount] = useState(loadInvestmentAmount);
  const [investmentModalOpen, setInvestmentModalOpen] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const [error, setError] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const positions = activePortfolio?.positions ?? [];
  const unresolvedPositions = positions.filter((position) => !position.availability_checked && !position.available_from_date);
  const shouldResolveAvailability = positions.length > 0 && (availabilityRetry > 0 || !activePortfolio?.availability_checked || unresolvedPositions.length > 0);
  const unresolvedKey = shouldResolveAvailability ? positions.map((position) => `${position.market}:${position.code}`).join('|') : '';
  const allAvailabilityKnown = positions.length > 0 && positions.every((position) => position.availability_checked || Boolean(position.available_from_date));
  const allHaveQuotes = positions.length > 0 && positions.every((position) => Boolean(position.available_from_date));
  const allAvailableFrom = activePortfolio?.all_positions_available_from_date ?? null;
  const unavailablePositions = positions.filter((position) => position.availability_checked && !position.available_from_date);
  const startDateKey = startDate.replace(/\D/g, '');
  const laterAvailabilityPositions = positions.filter((position) => position.available_from_date && position.available_from_date.replace(/\D/g, '') > startDateKey);

  useEffect(() => { localStorage.setItem(RESEARCH_PORTFOLIOS_KEY, JSON.stringify(portfolios)); window.dispatchEvent(new Event(PORTFOLIOS_UPDATED_EVENT)); }, [portfolios]);
  useEffect(() => { if (activePortfolio) { setActiveId(activePortfolio.id); localStorage.setItem(RESEARCH_ACTIVE_KEY, activePortfolio.id); } else localStorage.removeItem(RESEARCH_ACTIVE_KEY); window.dispatchEvent(new Event(PORTFOLIOS_UPDATED_EVENT)); }, [activePortfolio?.id]);
  useEffect(() => { if (activePortfolio) localStorage.setItem(investmentAmountKey(activePortfolio.id), String(investmentAmount)); }, [activePortfolio?.id, investmentAmount]);
  useEffect(() => {
    if (!activePortfolio || !unresolvedKey) return;
    let cancelled = false;
    setAvailabilityLoading(true);
    setAvailabilityError('');
    getInstrumentHistoryStarts(profileId, positions.map(({ code, name, market, target_weight }) => ({ code, name, market, target_weight })))
      .then((availability) => {
        if (cancelled) return;
        setAvailabilityError('');
        setAvailabilityRetry(0);
        const byIdentity = new Map(availability.positions.map((row) => [`${row.market}:${row.code}`, row.available_from_date]));
        setPortfolios((current) => current.map((portfolio) => portfolio.id !== activePortfolio.id ? portfolio : ({ ...portfolio, all_positions_available_from_date: availability.all_positions_available_from_date ?? null, availability_checked: true, positions: portfolio.positions.map((position) => {
          const identity = `${position.market}:${position.code}`;
          return byIdentity.has(identity) ? { ...position, available_from_date: byIdentity.get(identity) ?? undefined, availability_checked: true } : position;
        }) })));
      })
      .catch((reason) => { if (!cancelled) setAvailabilityError(reason instanceof Error ? reason.message : '최초 시세일을 조회하지 못했습니다.'); })
      .finally(() => { if (!cancelled) setAvailabilityLoading(false); });
    return () => { cancelled = true; };
  }, [activePortfolio?.id, profileId, unresolvedKey, availabilityRetry]);
  useEffect(() => {
    const term = query.trim();
    if (!term) { setSuggestions([]); setSearching(false); setSearchError(''); return; }
    let cancelled = false;
    const timer = window.setTimeout(() => { setSearching(true); searchInstruments(market, term).then((items) => { if (!cancelled) { setSuggestions(items); setSearchError(''); } }).catch((reason) => { if (!cancelled) { setSuggestions([]); setSearchError(reason instanceof Error ? reason.message : '종목 검색에 실패했습니다.'); } }).finally(() => { if (!cancelled) setSearching(false); }); }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [market, query]);

  const updateActive = (update: (current: ResearchPortfolio) => ResearchPortfolio) => {
    if (!activePortfolio) return;
    setPortfolios((current) => current.map((portfolio) => portfolio.id === activePortfolio.id ? update(portfolio) : portfolio));
    setResult(null); setError('');
  };
  const createPortfolio = () => { const next = makePortfolio(); setPortfolios((current) => [...current, next]); setActiveId(next.id); setEditingName(true); setNameDraft(next.name); setResult(null); setImportMessage(''); };
  const saveName = () => { const name = nameDraft.trim(); if (name) updateActive((portfolio) => ({ ...portfolio, name })); setEditingName(false); };
  const saveInvestmentAmount = (amount: number) => { setInvestmentAmount(amount); setInvestmentModalOpen(false); setResult(null); };
  const deletePortfolio = () => {
    if (!activePortfolio || !window.confirm(`'${activePortfolio.name}' 연구실 포트폴리오를 삭제할까요?`)) return;
    const remaining = portfolios.filter((portfolio) => portfolio.id !== activePortfolio.id);
    const next = remaining[remaining.length - 1];
    setPortfolios(remaining); setActiveId(next?.id ?? '');
    if (next) localStorage.setItem(RESEARCH_ACTIVE_KEY, next.id); else localStorage.removeItem(RESEARCH_ACTIVE_KEY);
    setResult(null); setEditingName(false); setImportMessage('');
  };
  const importPortfolio = () => {
    setError(''); setResult(null);
    if (!dashboardLoaded) { setImportMessage('계좌 포트폴리오를 아직 불러오는 중입니다. 잠시 후 다시 시도해 주세요.'); return; }
    const selected = dashboardPositions.filter((position) => position.is_in_portfolio && position.target_weight > 0);
    if (!selected.length) { setImportMessage('대시보드 포트폴리오에 포함된 종목이 없습니다. 대시보드에서 종목과 목표 비중을 먼저 설정해 주세요.'); return; }
    if (!activePortfolio) { const next = { ...makePortfolio('계좌 포트폴리오'), availability_checked: false, positions: selected.map((position) => ({ code: position.code, name: position.name, market: position.market ?? 'KR', target_weight: position.target_weight, availability_checked: false })) }; setPortfolios((current) => [...current, next]); setActiveId(next.id); setImportMessage(`${selected.length}개 종목과 목표 비중을 불러왔습니다.`); return; }
    updateActive((portfolio) => ({ ...portfolio, availability_checked: false, all_positions_available_from_date: null, positions: selected.map((position) => {
      const previous = portfolio.positions.find((item) => item.code === position.code && item.market === (position.market ?? 'KR'));
      return { code: position.code, name: position.name, market: position.market ?? 'KR', target_weight: position.target_weight, available_from_date: previous?.available_from_date, availability_checked: Boolean(previous?.availability_checked || previous?.available_from_date) };
    }) }));
    setImportMessage(`${selected.length}개 종목과 목표 비중을 “${activePortfolio.name}”에 불러왔습니다.`);
  };
  const addInstrument = (item: InstrumentSearchResult) => {
    if (positions.some((position) => position.code === item.code && position.market === item.market)) { setSearchError('이미 이 포트폴리오에 추가된 종목입니다.'); return; }
    updateActive((portfolio) => {
      const next = [...portfolio.positions, { code: item.code, name: item.name, market: item.market, target_weight: 0, availability_checked: false }];
      const equal = Math.round((100 / next.length) * 10) / 10;
      return { ...portfolio, availability_checked: false, all_positions_available_from_date: null, positions: next.map((position, index) => ({ ...position, target_weight: index === next.length - 1 ? Math.round((100 - equal * (next.length - 1)) * 10) / 10 : equal })) };
    });
    setQuery(''); setSuggestions([]); setSearchError('');
  };
  const updateWeight = (code: string, selectedMarket: Market, weight: number) => { if (!Number.isFinite(weight) || weight < 0 || weight > 100) return; updateActive((portfolio) => ({ ...portfolio, positions: portfolio.positions.map((item) => item.code === code && item.market === selectedMarket ? { ...item, target_weight: weight } : item) })); };
  const removePosition = (code: string, selectedMarket: Market) => updateActive((portfolio) => ({ ...portfolio, availability_checked: false, all_positions_available_from_date: null, positions: portfolio.positions.filter((item) => !(item.code === code && item.market === selectedMarket)) }));
  const calculate = async () => {
    if (!positions.length) { setError('종목을 추가하거나 계좌 포트폴리오를 불러와 주세요.'); return; }
    if (!positions.some((position) => position.target_weight > 0)) { setError('목표 비중이 0%보다 큰 종목이 필요합니다.'); return; }
    if (!startDate) { setError('시작 날짜를 확인해 주세요.'); return; }
    if (mode === 'once' && (!Number.isFinite(investmentAmount) || investmentAmount <= 0)) { setError('1회 매수 금액을 0보다 크게 입력해 주세요.'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const computed = await runBacktest(profileId, { start_date: startDate, mode, frequency, investment_amount: mode === 'once' ? investmentAmount : undefined, positions: positions.map(({ code, name, market: itemMarket, target_weight }) => ({ code, name, market: itemMarket, target_weight })) });
      updateActive((portfolio) => ({ ...portfolio, positions: portfolio.positions.map((item) => ({ ...item, available_from_date: computed.positions.find((row) => row.code === item.code && row.market === item.market)?.available_from_date ?? item.available_from_date, availability_checked: true })) }));
      setResult(computed);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '수익률을 계산하지 못했습니다.'); } finally { setLoading(false); }
  };
  const weightTotal = useMemo(() => positions.reduce((sum, item) => sum + item.target_weight, 0), [positions]);

  return <div className="research-lab">
    {activePortfolio ? <>
      <div className="portfolio-title-row">{editingName ? <input className="portfolio-title-input" aria-label="연구실 포트폴리오 이름" autoFocus maxLength={30} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onBlur={saveName} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setNameDraft(activePortfolio.name); setEditingName(false); } }}/> : <><h1>{activePortfolio.name}</h1><button className="portfolio-title-edit" type="button" aria-label="연구실 포트폴리오 이름 수정" title="포트폴리오 이름 수정" onClick={() => { setNameDraft(activePortfolio.name); setEditingName(true); }}><Pencil size={15}/></button><button className="portfolio-title-delete" type="button" aria-label="연구실 포트폴리오 삭제" title="포트폴리오 삭제" onClick={deletePortfolio}><Trash2 size={15}/></button></>}</div>
      <section className="card research-import-card">
        <div className="research-section-title"><div><p>종목을 직접 추가하거나 현재 계좌에 계획된 포트폴리오를 가져옵니다.</p></div><button className="outline-button" type="button" onClick={importPortfolio} disabled={!dashboardLoaded}><RotateCw size={15}/> 계좌 포트폴리오 불러오기</button></div>
        <div className="research-add-stock"><label>종목 직접 추가</label><div className="research-search-controls"><select aria-label="시장 선택" value={market} onChange={(event) => { setMarket(event.target.value as Market); setQuery(''); }}><option value="KR">국내</option><option value="US">미국</option></select><div className="research-search-box"><Search size={15}/><input value={query} onChange={(event) => setQuery(market === 'US' ? event.target.value.toUpperCase() : event.target.value)} placeholder={market === 'KR' ? '종목명 또는 코드 검색' : '종목명 또는 티커 검색'}/>{query && <button type="button" aria-label="검색어 지우기" onClick={() => setQuery('')}><X size={14}/></button>}</div></div>
          {query.trim() && <div className="research-search-results">{searching ? <p>종목 검색 중…</p> : suggestions.length ? suggestions.map((item) => { const duplicate = positions.some((position) => position.code === item.code && position.market === item.market); return <button type="button" key={`${item.market}:${item.code}`} disabled={duplicate} onClick={() => addInstrument(item)}><span><b>{item.name}</b><small>{item.code}{item.is_etf ? ' · ETF' : ''}</small></span><span>{duplicate ? '추가됨' : '추가 +'}</span></button>; }) : <p>{searchError || '일치하는 종목이 없습니다.'}</p>}</div>}
        </div>
        {importMessage && <p className="research-import-message">{importMessage}</p>}
        {positions.length > 0 ? <><div className="table-scroll"><table className="research-positions-table"><thead><tr><th className="stock-heading">종목</th><th>시장</th><th>목표 비중</th><th>최초 확인 거래일</th><th></th></tr></thead><tbody>{positions.map((position) => <tr key={`${position.market}:${position.code}`}><td className="purchase-stock-name"><b>{position.name}</b><small>{position.code}</small></td><td>{position.market === 'KR' ? '국내' : '미국'}</td><td><label className="research-weight"><input aria-label={`${position.name} 목표 비중`} type="number" min="0" max="100" step="0.1" value={position.target_weight} onChange={(event) => updateWeight(position.code, position.market, Number(event.target.value))}/><span>%</span></label></td><td>{position.available_from_date ? displayDate(position.available_from_date) : availabilityError && !position.availability_checked ? '조회 실패' : availabilityLoading && !position.availability_checked ? '조회 중…' : position.availability_checked ? '시세 없음' : '조회 대기'}</td><td><button type="button" className="research-remove-stock" aria-label={`${position.name} 제거`} title="종목 제거" onClick={() => removePosition(position.code, position.market)}><X size={15}/></button></td></tr>)}</tbody></table></div><div className="research-availability-summary"><p>목표 비중 합계 {weightTotal.toFixed(1)}%. 최초 확인 거래일은 API가 제공하는 가장 이른 일별 시세일이며, 공식 상장일과 다를 수 있습니다.</p>{allAvailableFrom ? <p><b>모든 종목 매수 가능 기준일</b> · {displayDate(allAvailableFrom)}</p> : availabilityLoading ? <p>종목별 최초 시세일을 확인하고 있습니다…</p> : allAvailabilityKnown && unavailablePositions.length ? <p>시세를 찾지 못한 종목이 있어 전체 매수 가능 기준일을 계산할 수 없습니다: {unavailablePositions.map((position) => position.name).join(', ')}</p> : allAvailabilityKnown && allHaveQuotes ? <p>모든 종목의 공통 거래일을 찾지 못해 동시에 매수 가능한 기준일을 계산할 수 없습니다.</p> : <p>전체 종목 매수 가능 기준일을 계산 중입니다.</p>}{laterAvailabilityPositions.length > 0 && <div className="research-late-availability"><b>설정 시작일({displayDate(startDate)})보다 늦게 최초 시세가 확인된 종목</b><ul>{laterAvailabilityPositions.map((position) => <li key={`${position.market}:${position.code}`}>{position.name} · {displayDate(position.available_from_date!)}</li>)}</ul><span>이 날짜 전의 예정 매수는 건너뜁니다. 정기 매수는 원래 설정한 주기를 유지합니다.</span></div>}{(availabilityError || unavailablePositions.length > 0 || (allAvailabilityKnown && allHaveQuotes && !allAvailableFrom)) && <button type="button" className="research-retry-availability" disabled={availabilityLoading} onClick={() => setAvailabilityRetry((current) => current + 1)}>{availabilityLoading ? '조회 중…' : '최초 시세일 다시 조회'}</button>}{availabilityError && <p className="research-error">{availabilityError}</p>}</div></> : <p className="research-empty">종목을 검색해 추가하거나 계좌 포트폴리오를 불러오세요.</p>}
      </section>
      <div className="research-simulation-layout">
        <section className="card research-simulation-card"><div className="research-section-title"><div><h2>수익률 예상해보기</h2><p>과거 매수 시점과 투자 주기를 선택해 시뮬레이션합니다.</p></div></div><div className="research-form-grid"><label>매수 방식<select value={mode} onChange={(event) => { setMode(event.target.value as BacktestInput['mode']); setResult(null); }}><option value="once">과거 한 시점에 1회 매수</option><option value="recurring">과거 한 시점부터 주기적으로 매수</option></select></label>{mode === 'recurring' && <label>매수 주기<select value={frequency} onChange={(event) => { setFrequency(event.target.value as BacktestInput['frequency']); setResult(null); }}><option value="weekly">매주</option><option value="monthly">매월</option></select></label>}<label>시작 날짜<input type="date" value={startDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => { setStartDate(event.target.value); setResult(null); }}/></label></div>{mode === 'once' && <div className="research-budget-setting card stat-card"><div className="stat-top"><span>총 매수 금액</span><button className="budget-edit-button" type="button" aria-label="총 매수 금액 수정" title="총 매수 금액 수정" onClick={() => setInvestmentModalOpen(true)}><Pencil size={15}/></button></div><strong>{money(investmentAmount)}</strong><div className="stat-foot"><span className="muted">종목별 목표 비중으로 나눠 매수합니다</span></div></div>}<p className="research-method-note">선택 날짜 이후 가장 가까운 거래일의 종가로 매수한 것으로 계산합니다. 상장 전 날짜를 선택하면 종목별 최초 확인 거래일부터 계산합니다. 목표 비중으로 투자금을 배분하며 수수료·세금·배당·환율 변동은 제외합니다.</p>{error && <p className="research-error">{error}</p>}<button className="research-run-button" type="button" onClick={() => void calculate()} disabled={loading}><Play size={15}/>{loading ? '과거 시세로 계산 중…' : '수익률 계산하기'}</button></section>
        <section className="card research-index-card"><div className="card-heading"><div><h2>포트폴리오 지수</h2><p>시뮬레이션 시작 시점 = 100</p></div><span className="research-index-value">{result?.index_series.length ? result.index_series[result.index_series.length - 1].value.toFixed(1) : '—'}</span></div>{result?.index_series.length ? <div className="research-index-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={result.index_series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><CartesianGrid stroke="#edf0f4" vertical={false}/><XAxis dataKey="date" tickFormatter={displayDate} minTickGap={28} tick={{ fill: '#929cab', fontSize: 9 }} axisLine={false} tickLine={false}/><YAxis domain={['auto', 'auto']} tick={{ fill: '#929cab', fontSize: 9 }} axisLine={false} tickLine={false}/><Tooltip labelFormatter={(label) => displayDate(String(label))} formatter={(value) => [Number(value).toFixed(2), '포트폴리오 지수']} contentStyle={{ border: '1px solid #e7ebf1', borderRadius: 8, fontSize: 10 }}/><ReferenceLine y={100} stroke="#c7ced9" strokeDasharray="4 4"/><Line type="monotone" dataKey="value" stroke="#6472ed" strokeWidth={2} dot={false} activeDot={{ r: 4 }}/></LineChart></ResponsiveContainer></div> : <div className="research-index-empty">수익률을 계산하면<br/>포트폴리오 지수 흐름을 보여드려요.</div>}<p className="research-index-note">매수 금액 유입을 반영한 기준 지수입니다. 환율·배당·수수료는 제외됩니다.</p></section>
      </div>
      {result && <section className="card research-result-card"><div className="research-result-summary"><div><span>시뮬레이션 수익률</span><strong className={result.return_pct === null ? 'muted' : result.return_pct >= 0 ? 'positive' : 'negative'}>{result.return_pct === null ? '예정된 매수 없음' : pct(result.return_pct)}</strong><small>{result.start_date}부터 {result.end_date}까지 · {result.mode === 'once' ? '1회 매수' : `${result.frequency === 'weekly' ? '매주' : '매월'} 매수`}</small>{result.mode === 'once' && result.investment_amount !== null && result.investment_amount !== undefined && <small>매수 {money(result.investment_amount)} · 현재 평가 {money(result.current_value ?? 0)} · 손익 <b className={(result.profit_amount ?? 0) >= 0 ? 'positive' : 'negative'}>{money(result.profit_amount ?? 0)}</b></small>}</div><span className="research-result-badge">과거 시세 기준</span></div><div className="table-scroll"><table className="research-results-table"><thead><tr><th className="stock-heading">종목</th><th>최초 확인 거래일</th><th>매수 횟수</th><th>평균 매입가</th><th>최근 종가</th>{result.mode === 'once' && <><th>배정 매수액</th><th>현재 평가액</th><th>손익</th></>}<th>수익률</th></tr></thead><tbody>{result.positions.map((position) => <tr key={`${position.market}:${position.code}`}><td className="purchase-stock-name"><b>{position.name}</b><small>{position.code}</small></td><td>{displayDate(position.available_from_date)}</td><td>{position.buy_count ? `${position.buy_count}회` : '매수 없음'}</td><td>{position.average_buy_price === null ? '—' : price(position.average_buy_price, position.market)}</td><td>{price(position.latest_price, position.market)}</td>{result.mode === 'once' && <><td>{money(position.invested_amount ?? 0)}</td><td>{money(position.current_value ?? 0)}</td><td className={(position.profit_amount ?? 0) >= 0 ? 'positive' : 'negative'}>{money(position.profit_amount ?? 0)}</td></>}<td className={position.return_pct === null ? 'muted' : position.return_pct >= 0 ? 'positive' : 'negative'}>{position.return_pct === null ? '매수 전' : pct(position.return_pct)}</td></tr>)}</tbody></table></div><p className="research-method-note">실제 체결가가 아닌 일별 종가로 계산한 과거 시뮬레이션입니다. 최초 시세일 전의 예정 매수는 건너뛰며, 미래 수익을 보장하지 않습니다.</p></section>}
    </> : <section className="card research-empty-state"><h2>연구실 포트폴리오가 없습니다</h2><p>+ 버튼으로 새 포트폴리오를 만들어 종목을 구성해 보세요.</p><button type="button" className="outline-button" onClick={createPortfolio}><Plus size={15}/> 포트폴리오 만들기</button></section>}
    {investmentModalOpen && <BudgetModal value={investmentAmount} subject="총 매수 금액" onClose={() => setInvestmentModalOpen(false)} onSave={saveInvestmentAmount}/>}
  </div>;
}
