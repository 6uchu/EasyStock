import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, GripVertical, Plus, X } from 'lucide-react';
import type { Position } from '../../types/portfolio';
import { money, nativeMoney, pct } from '../../utils/formatters';
import { calculateShareChange } from '../../utils/rebalance';

function TargetWeightEditor({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(value.toFixed(1));
  useEffect(() => setDraft(value.toFixed(1)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) onCommit(parsed);
    else setDraft(value.toFixed(1));
  };
  return <div className="target-weight-editor"><input aria-label="목표 비중 퍼센트" type="number" min="0" max="100" step="0.1" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } if (event.key === 'Escape') { setDraft(value.toFixed(1)); event.currentTarget.blur(); } }} /><span>%</span></div>;
}

function HoldingValueEditor({ value, label, step, onCommit }: { value: number; label: string; step: string; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() && Number.isFinite(parsed) && parsed >= 0) onCommit(parsed);
    else setDraft(String(value));
  };
  return <input className="holding-value-editor" aria-label={`${label} 수정`} title={`${label} 수정`} type="number" min="0" step={step} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } if (event.key === 'Escape') { setDraft(String(value)); event.currentTarget.blur(); } }} />;
}

export function PortfolioTable({ positions, total, budget, onRemove, onAdd, onTargetWeightChange, onHoldingChange, onMove }: { positions: Position[]; total: number; budget: number; onRemove: (code: string) => void; onAdd: () => void; onTargetWeightChange: (identity: string, weight: number) => void; onHoldingChange: (identity: string, field: 'quantity' | 'average_price' | 'current_price', value: number) => void; onMove: (identity: string, targetIdentity: string, after: boolean) => void }) {
  const [draggedIdentity, setDraggedIdentity] = useState('');
  const [dropTargetIdentity, setDropTargetIdentity] = useState('');
  const [dropAfter, setDropAfter] = useState(false);
  return <div className="table-scroll"><table><thead><tr><th aria-label="순서 변경"></th><th className="stock-heading">종목</th><th>변동 주 수</th><th>평단가</th><th>현재가</th><th>주수</th><th>평가금액</th><th>손익 원(%)</th><th>목표 비중 (%)</th><th>현재 비중(%)</th><th></th></tr></thead>
    <tbody>{positions.map((p) => { const value = p.quantity * p.current_price; const actual = total ? value / total * 100 : 0; const currentNative = p.current_price_native ?? p.current_price; const averageNative = p.average_price_native ?? p.average_price; const currency = p.currency ?? 'KRW'; const ret = averageNative ? (currentNative - averageNative) / averageNative * 100 : 0; const identity = `${p.market ?? 'KR'}:${p.code}`;
      const rawProfit = Math.trunc((p.current_price - p.average_price) * p.quantity);
      const profit = rawProfit === 0 ? 0 : rawProfit;
      const shareChange = calculateShareChange(p, budget);
      const dragState = draggedIdentity === identity ? 'dragging' : dropTargetIdentity === identity ? 'drop-target' : '';
      return <tr key={identity} className={`${dragState}${dragState === 'drop-target' && dropAfter ? ' drop-after' : ''}`} onDragOver={(event) => { event.preventDefault(); setDropTargetIdentity(identity); setDropAfter(event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2); }} onDrop={(event) => { event.preventDefault(); if (draggedIdentity) onMove(draggedIdentity, identity, event.clientY > event.currentTarget.getBoundingClientRect().top + event.currentTarget.getBoundingClientRect().height / 2); setDraggedIdentity(''); setDropTargetIdentity(''); setDropAfter(false); }}>
        <td className="drag-cell"><button type="button" className="drag-handle" draggable aria-label={`${p.name} 행을 끌어 순서 변경`} title="끌어서 순서 변경" onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', identity); setDraggedIdentity(identity); }} onDragEnd={() => { setDraggedIdentity(''); setDropTargetIdentity(''); setDropAfter(false); }}><GripVertical size={17}/></button></td>
        <td><div className={`stock`}><span className={`stock-icon market-flag ${p.market === 'US' ? 'us-flag' : 'kr-flag'}`} role="img" aria-label={p.market === 'US' ? '미국 국기' : '태극기'}><img src={p.market === 'US' ? '/flags/united-states.png' : '/flags/korea.png'} alt="" draggable={false}/></span><span><b>{p.name}</b><small>{p.code}</small></span></div></td><td className={shareChange > 0 ? 'share-change-buy' : shareChange < 0 ? 'share-change-sell' : 'share-change-zero'}><b>{shareChange > 0 ? '+' : ''}{shareChange.toLocaleString('ko-KR')}주</b></td><td className="muted"><HoldingValueEditor value={averageNative} label="평단가" step="0.01" onCommit={(next) => onHoldingChange(identity, 'average_price', currency === 'USD' ? next * (p.fx_rate ?? 1) : next)}/></td><td>{nativeMoney(currentNative, currency)}</td><td><HoldingValueEditor value={p.quantity} label="보유 주수" step="1" onCommit={(next) => onHoldingChange(identity, 'quantity', next)}/>주</td><td><b>{money(value)}</b></td><td className={profit >= 0 ? 'positive' : 'negative'}><span className="profit-amount">{profit >= 0 ? '+' : ''}{money(profit)}</span><small className="profit-rate">{ret >= 0 ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>} {pct(ret)}</small></td><td><TargetWeightEditor value={p.target_weight} onCommit={(weight) => onTargetWeightChange(identity, weight)}/></td><td>{actual.toFixed(1)}%</td><td>{p.is_in_portfolio && <button className="remove-planned" aria-label={`${p.name} 포트폴리오에서 제외`} title="포트폴리오에서 제외" onClick={() => onRemove(identity)}><X size={14}/></button>}</td>
      </tr>;
    })}<tr className="add-stock-row"><td colSpan={11}><button className="outline-button" onClick={onAdd}><Plus size={15}/> 종목 추가</button></td></tr></tbody></table></div>;
}
