import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, Bell, CircleHelp, FlaskConical, LayoutDashboard, Menu, Pencil, Plus, Search, Settings2, Trash2, WalletCards, RotateCw } from 'lucide-react';
import { deleteConnection, getAccounts, getConnections, getPortfolio, lookupInstrument, saveConnection } from './api/portfolio';
import type { Connection, Portfolio, PortfolioAccount } from './types/portfolio';
import { money, pct } from './utils/formatters';
import { PortfolioTable } from './components/portfolio/PortfolioTable';
import { PieChartSection } from './components/portfolio/PieChartSection';
import { RightSlidePanel } from './components/portfolio/RightSlidePanel';
import { RebalanceModal } from './components/common/RebalanceModal';
import { BudgetModal } from './components/common/BudgetModal';
import { Lobby } from './components/common/Lobby';
import { AddStockModal } from './components/portfolio/AddStockModal';
import { RESEARCH_ACTIVE_KEY, RESEARCH_PORTFOLIOS_KEY, ResearchLab } from './components/research/ResearchLab';
import type { ResearchPortfolio } from './components/research/ResearchLab';
import type { AddPositionInput } from './components/portfolio/AddStockModal';

const PORTFOLIOS_KEY = 'easystock.portfolios';
const RECENT_PORTFOLIO_KEY = 'easystock.recentPortfolio';
const plannedKey = (profileId: string, accountNo: string) => `easystock.planned.${profileId}.${accountNo}`;
const includedKey = (profileId: string, accountNo: string) => `easystock.included.${profileId}.${accountNo}`;
const targetsKey = (profileId: string, accountNo: string) => `easystock.targets.${profileId}.${accountNo}`;
const orderKey = (profileId: string, accountNo: string) => `easystock.order.${profileId}.${accountNo}`;
const budgetKey = (profileId: string, accountNo: string) => `easystock.budget.${profileId}.${accountNo}`;
const holdingsKey = (profileId: string, accountNo: string) => `easystock.holdings.${profileId}.${accountNo}`;
const positionKey = (position: Portfolio['positions'][number]) => `${position.market ?? 'KR'}:${position.code}`;
const loadResearchPortfolios = (): ResearchPortfolio[] => { try { const value = JSON.parse(localStorage.getItem(RESEARCH_PORTFOLIOS_KEY) ?? '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };

export default function App() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionError, setConnectionError] = useState('');
  const [dashboardEntryError, setDashboardEntryError] = useState('');
  const [openingDashboard, setOpeningDashboard] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [accounts, setAccounts] = useState<PortfolioAccount[]>([]);
  const [expandedMenu, setExpandedMenu] = useState<'dashboard' | 'lab' | null>(null);
  const [activeSection, setActiveSection] = useState<'dashboard' | 'lab'>('dashboard');
  const [portfolios, setPortfolios] = useState<Array<{ profileId: string; accountNo: string; name: string }>>(() => { try { return JSON.parse(localStorage.getItem(PORTFOLIOS_KEY) ?? '[]').filter((item: { profileId?: string }) => item.profileId !== 'local'); } catch { return []; } });
  const [researchPortfolios, setResearchPortfolios] = useState<ResearchPortfolio[]>(loadResearchPortfolios);
  const [activeResearchId, setActiveResearchId] = useState(() => localStorage.getItem(RESEARCH_ACTIVE_KEY) ?? '');
  const [editingPortfolioName, setEditingPortfolioName] = useState(false);
  const [portfolioNameDraft, setPortfolioNameDraft] = useState('');
  const [accountsLoadedFor, setAccountsLoadedFor] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [portfolioLoadedFor, setPortfolioLoadedFor] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [resettingHoldings, setResettingHoldings] = useState(false);
  const [modal, setModal] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetOverride, setBudgetOverride] = useState<number | null>(null);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    getConnections()
      .then(setConnections)
      .catch((reason: Error) => setConnectionError(reason.message));
  }, []);

  useEffect(() => {
    const refreshResearchMenu = () => {
      setResearchPortfolios(loadResearchPortfolios());
      setActiveResearchId(localStorage.getItem(RESEARCH_ACTIVE_KEY) ?? '');
    };
    window.addEventListener('easystock:research-portfolios-updated', refreshResearchMenu);
    return () => window.removeEventListener('easystock:research-portfolios-updated', refreshResearchMenu);
  }, []);

  const openResearchPortfolio = (portfolioId: string) => {
    localStorage.setItem(RESEARCH_ACTIVE_KEY, portfolioId);
    setActiveResearchId(portfolioId);
    setActiveSection('lab');
    setMobileOpen(false);
  };

  const createResearchPortfolio = () => {
    const next: ResearchPortfolio = { id: crypto.randomUUID(), name: '새 포트폴리오', positions: [] };
    const updated = [...researchPortfolios, next];
    localStorage.setItem(RESEARCH_PORTFOLIOS_KEY, JSON.stringify(updated));
    localStorage.setItem(RESEARCH_ACTIVE_KEY, next.id);
    setResearchPortfolios(updated);
    setActiveResearchId(next.id);
    setActiveSection('lab');
    setMobileOpen(false);
    window.dispatchEvent(new Event('easystock:research-portfolios-updated'));
  };

  const openConnection = (connection: Connection, accountNo = '') => {
    const connectionChanged = profileId !== connection.id;
    const accountChanged = selectedAccount !== accountNo;
    setConnectionError('');
    if (connectionChanged) {
      setAccounts([]);
      setAccountsLoadedFor('');
    }
    setSelectedAccount(accountNo);
    if (connectionChanged || accountChanged) {
      setPortfolio(null);
      setPortfolioLoadedFor('');
    }
    setProfileId(connection.id);
  };

  const rememberPortfolio = (connectionId: string, accountNo: string) => {
    const identity = `${connectionId}:${accountNo}`;
    const connection = connections.find((item) => item.id === connectionId);
    const existing = portfolios.find((item) => `${item.profileId}:${item.accountNo}` === identity);
    const next = existing ? portfolios : [...portfolios, {
      profileId: connectionId, accountNo,
      name: `${connection?.label ?? '내 계정'} 포트폴리오`.slice(0, 30),
    }];
    setPortfolios(next);
    localStorage.setItem(PORTFOLIOS_KEY, JSON.stringify(next));
    localStorage.setItem(RECENT_PORTFOLIO_KEY, identity);
  };

  const openPortfolio = (connection: Connection, accountNo: string) => {
    rememberPortfolio(connection.id, accountNo);
    openConnection(connection, accountNo);
  };


  const openRecentPortfolio = async () => {
    if (openingDashboard) return;
    setDashboardEntryError('');
    setOpeningDashboard(true);
    const recent = localStorage.getItem(RECENT_PORTFOLIO_KEY);
    let target = portfolios.find((item) => `${item.profileId}:${item.accountNo}` === recent) ?? portfolios[portfolios.length - 1];
    let connection = target && connections.find((item) => item.id === target.profileId);
    try {
      // Migrate profiles created before the explicit portfolio list was added.
      if (!target) {
        const legacyProfileId = localStorage.getItem('easystock.lastProfile');
        const legacyConnection = connections.find((item) => item.id === legacyProfileId);
        if (legacyConnection) {
          const legacyAccounts = await getAccounts(legacyConnection.id);
          const savedAccountNos = new Set<string>();
          for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index) ?? '';
            const prefix = `easystock.`;
            if (!key.startsWith(prefix)) continue;
            const parts = key.split('.');
            if (parts.length >= 4 && parts[2] === legacyProfileId) savedAccountNos.add(parts.slice(3).join('.'));
          }
          const legacyAccount = legacyAccounts.find((account) => savedAccountNos.has(account.account_no))
            ?? (legacyAccounts.length === 1 ? legacyAccounts[0] : undefined);
          if (legacyAccount) {
            target = { profileId: legacyConnection.id, accountNo: legacyAccount.account_no, name: `${legacyConnection.label} 포트폴리오`.slice(0, 30) };
            connection = legacyConnection;
            rememberPortfolio(legacyConnection.id, legacyAccount.account_no);
          } else if (legacyAccounts.length > 1) {
            setOpeningDashboard(false);
            openConnection(legacyConnection);
            return;
          }
        }
      }
      if (!target && recent) {
        const separator = recent.lastIndexOf(':');
        if (separator > 0) {
          const profileIdFromRecent = recent.slice(0, separator);
          const accountNoFromRecent = recent.slice(separator + 1);
          const recentConnection = connections.find((item) => item.id === profileIdFromRecent);
          if (recentConnection) {
            target = { profileId: profileIdFromRecent, accountNo: accountNoFromRecent, name: `${recentConnection.label} 포트폴리오`.slice(0, 30) };
            connection = recentConnection;
          }
        }
      }
      if (!target) {
        setDashboardEntryError(portfolios.length ? '저장된 증권사 연결을 찾을 수 없습니다. 증권사 계정을 다시 연결해 주세요.' : '아직 포트폴리오가 없습니다. 먼저 증권사 계정을 연결하고 계좌를 선택해 주세요.');
        return;
      }
      if (!connection) {
        setDashboardEntryError('저장된 증권사 연결을 찾을 수 없습니다. 증권사 계정을 다시 연결해 주세요.');
        return;
      }
      await getPortfolio(connection.id, target.accountNo);
      openPortfolio(connection, target.accountNo);
    } catch (reason) {
      const detail = reason instanceof Error && reason.message ? ` (${reason.message})` : '';
      setDashboardEntryError(`증권사 계정 정보를 확인할 수 없습니다. 키와 계좌 연결을 확인한 뒤 증권사 계정을 다시 연결해 주세요.${detail}`);
    } finally {
      setOpeningDashboard(false);
    }
  };

  const addConnection = async (input: { broker_id: string; label: string; app_key: string; app_secret: string }) => {
    setSavingConnection(true);
    setConnectionError('');
    try {
      const connection = await saveConnection(input);
      setConnections((current) => [connection, ...current]);
      openConnection(connection);
    } catch (reason) {
      setConnectionError(reason instanceof Error ? reason.message : '증권사 연결을 저장하지 못했습니다.');
    } finally {
      setSavingConnection(false);
    }
  };

  const removeConnection = async (connection: Connection) => {
    if (!window.confirm(`'${connection.label}' 연결과 저장된 키를 삭제할까요?`)) return;
    setConnectionError('');
    try {
      await deleteConnection(connection.id);
      setConnections((current) => current.filter((item) => item.id !== connection.id));
      const remaining = portfolios.filter((item) => item.profileId !== connection.id);
      setPortfolios(remaining);
      localStorage.setItem(PORTFOLIOS_KEY, JSON.stringify(remaining));
      if (localStorage.getItem(RECENT_PORTFOLIO_KEY)?.startsWith(`${connection.id}:`)) {
        localStorage.removeItem(RECENT_PORTFOLIO_KEY);
      }
    } catch (reason) {
      setConnectionError(reason instanceof Error ? reason.message : '저장된 연결을 삭제하지 못했습니다.');
    }
  };

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    setAccounts([]);
    setPortfolio(null);
    setError('');
    getAccounts(profileId)
      .then((result) => {
        if (cancelled) return;
        setAccounts(result);
        if (result.length === 1) {
          rememberPortfolio(profileId, result[0].account_no);
          setSelectedAccount(result[0].account_no);
        }
        if (result.length === 0) setError('이 연결에서 사용할 수 있는 운영 계좌가 없습니다. NH PLUG 계좌 연결과 API 사용 권한을 확인해 주세요.');
        setAccountsLoadedFor(profileId);
      })
      .catch((reason: Error) => { if (!cancelled) { setError(reason.message); setAccountsLoadedFor(profileId); } });
    return () => { cancelled = true; };
  }, [profileId]);

  useEffect(() => {
    if (!profileId || !selectedAccount) return;
    let cancelled = false;
    setPortfolio(null);
    setError('');
    getPortfolio(profileId, selectedAccount)
      .then((result) => {
        if (cancelled) return;
        const saved = localStorage.getItem(plannedKey(profileId, selectedAccount));
        let planned: Portfolio['positions'] = [];
        try { planned = saved ? JSON.parse(saved) : []; } catch { planned = []; }
        let included: string[] = [];
        let targets: Record<string, number> = {};
        const savedIncluded = localStorage.getItem(includedKey(profileId, selectedAccount));
        try { included = savedIncluded === null ? result.positions.map(positionKey) : JSON.parse(savedIncluded); } catch { included = result.positions.map(positionKey); }
        try { targets = JSON.parse(localStorage.getItem(targetsKey(profileId, selectedAccount)) ?? '{}'); } catch { targets = {}; }
        let holdingOverrides: Record<string, { quantity?: number; average_price?: number }> = {};
        try { holdingOverrides = JSON.parse(localStorage.getItem(holdingsKey(profileId, selectedAccount)) ?? '{}'); } catch { holdingOverrides = {}; }
        const live = result.positions.map((position) => ({
          ...position,
          ...holdingOverrides[positionKey(position)],
          ...(holdingOverrides[positionKey(position)]?.average_price !== undefined ? { average_price_native: position.currency === 'USD' ? holdingOverrides[positionKey(position)].average_price! / (position.fx_rate || 1) : holdingOverrides[positionKey(position)].average_price } : {}),
          is_in_portfolio: included.includes(positionKey(position)),
          target_weight: targets[positionKey(position)] ?? position.target_weight,
        }));
        const merged = [...live, ...planned.filter((item) => !live.some((position) => positionKey(position) === positionKey(item))).map((item) => ({ ...item, is_in_portfolio: item.is_in_portfolio ?? true }))];
        let savedOrder: string[] = [];
        try {
          const parsed: unknown = JSON.parse(localStorage.getItem(orderKey(profileId, selectedAccount)) ?? '[]');
          savedOrder = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
        } catch { savedOrder = []; }
        const rank = new Map(savedOrder.map((identity, index) => [identity, index]));
        merged.sort((a, b) => (rank.get(positionKey(a)) ?? Number.MAX_SAFE_INTEGER) - (rank.get(positionKey(b)) ?? Number.MAX_SAFE_INTEGER));
        setPortfolio({ ...result, positions: merged });
        setPortfolioLoadedFor(`${profileId}:${selectedAccount}`);
      })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message); });
    return () => { cancelled = true; };
  }, [profileId, selectedAccount]);

  useEffect(() => {
    if (!profileId || !selectedAccount) { setBudgetOverride(null); return; }
    const savedBudget = localStorage.getItem(budgetKey(profileId, selectedAccount));
    const parsed = savedBudget === null ? null : Number(savedBudget);
    setBudgetOverride(parsed !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : null);
  }, [profileId, selectedAccount]);

  const stats = useMemo(() => {
    const positions = portfolio?.positions ?? [];
    const cash = portfolio?.cash ?? 0;
    const invested = positions.reduce((sum, position) => sum + position.quantity * position.current_price, 0);
    const cost = positions.reduce((sum, position) => sum + position.quantity * position.average_price, 0);
    return { invested, total: invested + cash, profit: invested - cost, returnRate: cost ? (invested - cost) / cost * 100 : 0 };
  }, [portfolio]);
  const budgetAmount = budgetOverride ?? stats.total;

  const saveBudget = (amount: number) => {
    localStorage.setItem(budgetKey(profileId, selectedAccount), String(amount));
    setBudgetOverride(amount);
    setBudgetModalOpen(false);
  };

  const savePortfolioName = (name: string) => {
    const normalized = name.trim().slice(0, 30);
    if (!normalized) { setPortfolioNameDraft(currentPortfolio?.name ?? '내 포트폴리오'); setEditingPortfolioName(false); return; }
    const next = portfolios.map((item) => item.profileId === profileId && item.accountNo === selectedAccount ? { ...item, name: normalized } : item);
    setPortfolios(next);
    localStorage.setItem(PORTFOLIOS_KEY, JSON.stringify(next));
    setEditingPortfolioName(false);
  };

  const deleteCurrentPortfolio = () => {
    const target = portfolios.find((item) => item.profileId === profileId && item.accountNo === selectedAccount);
    if (!target || !window.confirm(`'${target.name}' 포트폴리오를 삭제할까요? 저장된 목표 비중과 대시보드 설정이 삭제되며, 증권사 계좌와 실제 보유 종목은 그대로 유지됩니다.`)) return;

    const remaining = portfolios.filter((item) => !(item.profileId === profileId && item.accountNo === selectedAccount));
    setPortfolios(remaining);
    localStorage.setItem(PORTFOLIOS_KEY, JSON.stringify(remaining));
    for (const key of [
      plannedKey(profileId, selectedAccount), includedKey(profileId, selectedAccount),
      targetsKey(profileId, selectedAccount), orderKey(profileId, selectedAccount),
      budgetKey(profileId, selectedAccount), holdingsKey(profileId, selectedAccount),
    ]) localStorage.removeItem(key);

    const nextPortfolio = [...remaining].reverse().find((item) => connections.some((connection) => connection.id === item.profileId));
    if (nextPortfolio) localStorage.setItem(RECENT_PORTFOLIO_KEY, `${nextPortfolio.profileId}:${nextPortfolio.accountNo}`);
    else localStorage.removeItem(RECENT_PORTFOLIO_KEY);
    if (nextPortfolio) {
      const connection = connections.find((item) => item.id === nextPortfolio.profileId);
      if (connection) openConnection(connection, nextPortfolio.accountNo);
      else setProfileId('');
    } else {
      setSelectedAccount('');
      setProfileId('');
    }
  };

  const savePlannedPositions = (positions: Portfolio['positions']) => {
    if (!portfolio) return;
    const planned = positions.filter((position) => position.is_planned);
    localStorage.setItem(plannedKey(profileId, selectedAccount), JSON.stringify(planned));
    localStorage.setItem(includedKey(profileId, selectedAccount), JSON.stringify(positions.filter((position) => !position.is_planned && position.is_in_portfolio).map(positionKey)));
    localStorage.setItem(targetsKey(profileId, selectedAccount), JSON.stringify(Object.fromEntries(positions.map((position) => [positionKey(position), position.target_weight]))));
    setPortfolio({ ...portfolio, positions });
  };

  const addPlannedPosition = (input: AddPositionInput) => {
    if (!portfolio) return;
    const existing = portfolio.positions.find((position) => (position.market ?? 'KR') === input.market && position.code === input.code);
    if (existing) {
      if (existing.is_planned) return;
      savePlannedPositions(portfolio.positions.map((position) => positionKey(position) === positionKey(existing) ? { ...position, target_weight: input.targetWeight, is_in_portfolio: true } : position));
    } else {
      const position: Portfolio['positions'][number] = {
        code: input.code, name: input.name, target_weight: input.targetWeight, quantity: 0,
        current_price: input.currentPrice, average_price: input.currentPrice,
        current_price_native: input.currentPrice, average_price_native: input.currentPrice,
        is_planned: true, is_in_portfolio: true, market: input.market, currency: input.currency,
      };
      savePlannedPositions([...portfolio.positions, position]);
    }
    setAddStockOpen(false);
  };

  const updateTargetWeight = (identity: string, targetWeight: number) => {
    if (!portfolio || !Number.isFinite(targetWeight) || targetWeight < 0 || targetWeight > 100) return;
    savePlannedPositions(portfolio.positions.map((position) => positionKey(position) === identity ? { ...position, target_weight: targetWeight } : position));
  };

  const updateHolding = (identity: string, field: 'quantity' | 'average_price' | 'current_price', value: number) => {
    if (!portfolio || !Number.isFinite(value) || value < 0) return;
    const positions = portfolio.positions.map((position) => positionKey(position) === identity ? {
      ...position,
      [field]: value,
      ...(field === 'average_price' ? { average_price_native: position.currency === 'USD' ? value / (position.fx_rate || 1) : value } : {}),
      ...(field === 'current_price' ? { current_price_native: value } : {}),
    } : position);
    let overrides: Record<string, { quantity?: number; average_price?: number }> = {};
    try { overrides = JSON.parse(localStorage.getItem(holdingsKey(profileId, selectedAccount)) ?? '{}'); } catch { overrides = {}; }
    const current = overrides[identity] ?? {};
    overrides[identity] = { ...current, [field]: value };
    localStorage.setItem(holdingsKey(profileId, selectedAccount), JSON.stringify(overrides));
    setPortfolio({ ...portfolio, positions });
  };

  const removeFromPortfolio = (identity: string) => {
    if (!portfolio) return;
    const positions = portfolio.positions.flatMap((position) => {
      if (positionKey(position) !== identity) return [position];
      return position.is_planned ? [] : [{ ...position, is_in_portfolio: false }];
    });
    savePlannedPositions(positions);
  };

  const movePosition = (identity: string, targetIdentity: string, after: boolean) => {
    if (!portfolio) return;
    const positions = [...portfolio.positions];
    const from = positions.findIndex((position) => positionKey(position) === identity);
    const target = positions.findIndex((position) => positionKey(position) === targetIdentity);
    if (from < 0 || target < 0 || from === target) return;
    const [moved] = positions.splice(from, 1);
    const targetAfterRemoval = positions.findIndex((position) => positionKey(position) === targetIdentity);
    positions.splice(targetAfterRemoval + (after ? 1 : 0), 0, moved);
    localStorage.setItem(orderKey(profileId, selectedAccount), JSON.stringify(positions.map(positionKey)));
    setPortfolio({ ...portfolio, positions });
  };

  const refreshPortfolio = async (resetManualHoldings = false) => {
    if (!profileId || !selectedAccount || refreshing || resettingHoldings) return;
    if (resetManualHoldings) {
      localStorage.removeItem(holdingsKey(profileId, selectedAccount));
      setResettingHoldings(true);
    } else {
      setRefreshing(true);
    }
    setError('');
    try {
      const result = await getPortfolio(profileId, selectedAccount);
      const oldPositions = portfolio?.positions ?? [];
      const oldByKey = new Map(oldPositions.map((position) => [positionKey(position), position]));
      const live = result.positions.map((position) => {
        const old = oldByKey.get(positionKey(position));
        let overrides: Record<string, { quantity?: number; average_price?: number }> = {};
        try { overrides = JSON.parse(localStorage.getItem(holdingsKey(profileId, selectedAccount)) ?? '{}'); } catch { overrides = {}; }
        const holdingOverride = overrides[positionKey(position)];
        return { ...position, ...holdingOverride, ...(holdingOverride?.average_price !== undefined ? { average_price_native: position.currency === 'USD' ? holdingOverride.average_price / (position.fx_rate || 1) : holdingOverride.average_price } : {}), is_in_portfolio: old?.is_in_portfolio ?? false, target_weight: old?.target_weight ?? position.target_weight };
      });
      const planned = await Promise.all(oldPositions.filter((position) => position.is_planned).map(async (position) => {
        try {
          const quote = await lookupInstrument(profileId, position.market ?? 'KR', position.code);
          return { ...position, name: quote.name || position.name, current_price: quote.price, current_price_native: quote.price };
        } catch { return position; }
      }));
      const merged = [...live, ...planned.filter((item) => !live.some((position) => positionKey(position) === positionKey(item)))];
      const rank = new Map(oldPositions.map((position, index) => [positionKey(position), index]));
      merged.sort((a, b) => (rank.get(positionKey(a)) ?? Number.MAX_SAFE_INTEGER) - (rank.get(positionKey(b)) ?? Number.MAX_SAFE_INTEGER));
      localStorage.setItem(plannedKey(profileId, selectedAccount), JSON.stringify(merged.filter((position) => position.is_planned)));
      setPortfolio({ ...result, positions: merged });
      setPortfolioLoadedFor(`${profileId}:${selectedAccount}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '시세를 새로고침하지 못했습니다.');
    } finally {
      if (resetManualHoldings) setResettingHoldings(false);
      else setRefreshing(false);
    }
  };

  if (!profileId) return <Lobby connections={connections} saving={savingConnection} error={connectionError} dashboardError={dashboardEntryError} openingDashboard={openingDashboard} onSave={addConnection} onDashboard={openRecentPortfolio} onSelect={openConnection} onDelete={removeConnection}/>;
  if (accountsLoadedFor !== profileId) return <main className="transition-screen"><span>계좌 연결 확인 중…</span></main>;
  if (error && !selectedAccount) return <main className="connection-error"><div className="error-card"><span className="brand-mark"><Activity size={21}/></span><h1>증권사 계좌에 연결할 수 없습니다</h1><p>{error}</p><ol><li>백엔드 서버가 실행 중인지 확인하세요.</li><li>증권사 API 사용 신청과 계좌 연결 권한을 확인하세요.</li><li>증권사 키가 맞는지 확인한 뒤 로비에서 연결 정보를 다시 등록하세요.</li></ol><button className="primary-button" onClick={() => setProfileId('')}>로비로 돌아가기</button></div></main>;
  if (accounts.length > 1 && !selectedAccount) return <main className="connection-error"><div className="account-select-wrap"><button className="lobby-back-button account-back-button" onClick={() => setProfileId('')}><ArrowLeft size={15}/> 다른 연결 선택</button><div className="error-card"><span className="brand-mark"><WalletCards size={21}/></span><h1>포트폴리오를 만들 계좌를 선택하세요</h1><p>선택한 계좌가 대시보드에 저장됩니다.</p><div className="account-select-large"><select value="" onChange={(event) => { const connection = connections.find((item) => item.id === profileId); if (connection) openPortfolio(connection, event.target.value); }}><option value="" disabled>계좌 선택</option>{accounts.map((account) => <option key={account.account_no} value={account.account_no}>{account.account_no} · {account.account_type === '02' ? '주문대리인' : '일반'}</option>)}</select></div></div></div></main>;
  if (error && selectedAccount) return <main className="connection-error"><div className="error-card"><span className="brand-mark"><Activity size={21}/></span><h1>계좌 잔고를 불러오지 못했습니다</h1><p>{error}</p><ol><li>백엔드 터미널의 NH API 응답을 확인하세요.</li><li>계좌의 PLUG API 사용 신청과 권한을 확인하세요.</li></ol><button className="primary-button" onClick={() => setProfileId('')}>로비로 돌아가기</button></div></main>;
  if (selectedAccount && portfolioLoadedFor !== `${profileId}:${selectedAccount}`) return <main className="transition-screen"><span>포트폴리오 불러오는 중…</span></main>;
  const displayedPortfolio = portfolio ?? { positions: [], cash: 0 };
  const currentPortfolio = portfolios.find((item) => item.profileId === profileId && item.accountNo === selectedAccount);

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand"><span className="brand-mark"><Activity size={21}/></span><span>easy<span>stock</span></span></div>
      <div className="workspace-label">WORKSPACE</div>
      <button className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`} aria-expanded={expandedMenu === 'dashboard'} onClick={() => { setActiveSection('dashboard'); setExpandedMenu((current) => current === 'dashboard' ? null : 'dashboard'); void openRecentPortfolio(); setMobileOpen(false); }}><LayoutDashboard size={18}/> 대시보드</button>
      {expandedMenu === 'dashboard' && <div className="account-submenu">{portfolios.filter((item) => connections.some((connection) => connection.id === item.profileId)).map((item) => { const connection = connections.find((candidate) => candidate.id === item.profileId); const selected = item.profileId === profileId && item.accountNo === selectedAccount; return <button className={`account-submenu-item${selected ? ' selected' : ''}`} key={`${item.profileId}:${item.accountNo}`} title={item.name} onClick={() => connection && openPortfolio(connection, item.accountNo)}><WalletCards size={14}/><span>{item.name}</span></button>; })}</div>}
      <button className={`nav-item ${activeSection === 'lab' ? 'active' : ''}`} aria-expanded={expandedMenu === 'lab'} onClick={() => { setActiveSection('lab'); setExpandedMenu((current) => current === 'lab' ? null : 'lab'); setMobileOpen(false); }}><FlaskConical size={18}/> 연구실</button>
      {expandedMenu === 'lab' && <div className="account-submenu research-sidebar-submenu">{researchPortfolios.map((item) => <button className={`account-submenu-item${item.id === activeResearchId ? ' selected' : ''}`} key={item.id} title={item.name} onClick={() => openResearchPortfolio(item.id)}><FlaskConical size={14}/><span>{item.name}</span></button>)}<button className="account-submenu-item research-sidebar-add" onClick={createResearchPortfolio}><Plus size={14}/><span>새 포트폴리오</span></button></div>}
      <button className="nav-item inactive-feature-button" title="아직 사용할 수 없는 기능입니다."><Activity size={18}/> 거래 내역</button>
      <div className="sidebar-bottom"><button className="nav-item inactive-feature-button" title="아직 사용할 수 없는 기능입니다."><CircleHelp size={18}/> 도움말</button><button className="nav-item inactive-feature-button" title="아직 사용할 수 없는 기능입니다."><Settings2 size={18}/> 설정</button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)}><Menu/></button><div className="breadcrumb">내 자산 <span>/</span> <b>{activeSection === 'lab' ? '연구실' : '포트폴리오'}</b></div><div className="top-actions"><span className="market-status"><i/> NH 연결</span><button className="icon-button inactive-feature-button" title="아직 사용할 수 없는 기능입니다." aria-label="검색 기능 준비 중"><Search size={18}/></button><button className="icon-button notification inactive-feature-button" title="아직 사용할 수 없는 기능입니다." aria-label="알림 기능 준비 중"><Bell size={18}/><i/></button><button className="lobby-switch" onClick={() => setProfileId('')}>포트폴리오 추가</button></div></header>
      <div className="content">
        {activeSection === 'lab' ? <ResearchLab key={activeResearchId} profileId={profileId} dashboardPositions={displayedPortfolio.positions} dashboardLoaded={portfolioLoadedFor === `${profileId}:${selectedAccount}`} /> : <>
        <div className="portfolio-title-row">{editingPortfolioName ? <input className="portfolio-title-input" aria-label="포트폴리오 이름" autoFocus maxLength={30} value={portfolioNameDraft} onChange={(event) => setPortfolioNameDraft(event.target.value)} onBlur={() => savePortfolioName(portfolioNameDraft)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setPortfolioNameDraft(currentPortfolio?.name ?? '내 포트폴리오'); setEditingPortfolioName(false); } }}/> : <><h1>{currentPortfolio?.name ?? '내 포트폴리오'}</h1><button className="portfolio-title-edit" type="button" aria-label="포트폴리오 이름 수정" title="포트폴리오 이름 수정" onClick={() => { setPortfolioNameDraft(currentPortfolio?.name ?? '내 포트폴리오'); setEditingPortfolioName(true); }}><Pencil size={15}/></button><button className="portfolio-title-delete" type="button" aria-label="포트폴리오 삭제" title="포트폴리오 삭제" onClick={deleteCurrentPortfolio}><Trash2 size={15}/></button></>}</div>
        <section className="stat-grid">
          <article className="card stat-card"><div className="stat-top"><span>예산</span><button className="budget-edit-button" type="button" aria-label="예산 수정" title="예산 수정" onClick={() => setBudgetModalOpen(true)}><Pencil size={15}/></button></div><strong>{money(budgetAmount)}</strong><div className="stat-foot"><span className="muted">예산은 직접 수정할 수 있습니다</span></div></article>
          <article className="card stat-card"><div className="stat-top"><span>총 평가 손익</span><span className="stat-symbol green">↗</span></div><strong className={stats.profit >= 0 ? 'positive' : 'negative'}>{stats.profit >= 0 ? '+' : ''}{money(stats.profit)}</strong><div className="stat-foot"><span className={stats.returnRate >= 0 ? 'positive' : 'negative'}>{pct(stats.returnRate)}</span><span className="muted">보유 종목 기준</span></div></article>
          <article className="card stat-card"><div className="stat-top"><span>포트폴리오 종목</span><span className="stat-symbol violet">▤</span></div><strong>{displayedPortfolio.positions.length}<small className="unit">개</small></strong><div className="stat-foot"><span className="muted">국내·미국 주식 및 ETF</span><span className="muted">실계좌 + 계획 종목</span></div></article>
        </section>
        <div className="dashboard-layout">
          <div className="dashboard-main">
            <PieChartSection positions={displayedPortfolio.positions} cash={displayedPortfolio.cash}/>
          </div>
          <RightSlidePanel cash={displayedPortfolio.cash} budget={stats.total} onRebalance={() => setModal(true)}/>
        </div>
        <section className="card holdings-card">
          <div className="card-heading holdings-heading"><div><h3>보유 종목</h3><p>총 {displayedPortfolio.positions.length}개 종목 · 실계좌 + 계획 종목</p></div><div className="holdings-actions"><button className="filter-button" type="button" onClick={() => void refreshPortfolio()} disabled={refreshing || resettingHoldings} title="현재가와 변동 주수 새로고침"><RotateCw size={15} className={refreshing ? 'spin' : ''}/> {refreshing ? '갱신 중…' : '새로고침'}</button><button className="filter-button" type="button" onClick={() => void refreshPortfolio(true)} disabled={refreshing || resettingHoldings} title="수동 입력값을 지우고 계좌 잔고로 되돌리기"><RotateCw size={15} className={resettingHoldings ? 'spin' : ''}/> {resettingHoldings ? '되돌리는 중…' : '계좌 값으로 되돌리기'}</button></div></div>
          <PortfolioTable positions={displayedPortfolio.positions} total={stats.total} budget={budgetAmount} onAdd={() => setAddStockOpen(true)} onRemove={removeFromPortfolio} onTargetWeightChange={updateTargetWeight} onHoldingChange={updateHolding} onMove={movePosition}/>
          <div className="table-footer">계좌 <b>{selectedAccount}</b></div>
        </section>
        <footer className="disclaimer">잔고 조회 전용입니다. 목표 비중을 저장하는 기능과 실제 주문 전송은 아직 연결되지 않았습니다.</footer>
        </>}
      </div>
    </main>
    {modal && <RebalanceModal positions={displayedPortfolio.positions} total={budgetAmount} onClose={() => setModal(false)}/>} 
    {budgetModalOpen && <BudgetModal value={budgetAmount} onClose={() => setBudgetModalOpen(false)} onSave={saveBudget}/>}
    {addStockOpen && <AddStockModal profileId={profileId} positions={displayedPortfolio.positions} onClose={() => setAddStockOpen(false)} onAdd={addPlannedPosition}/>}
  </div>;
}
