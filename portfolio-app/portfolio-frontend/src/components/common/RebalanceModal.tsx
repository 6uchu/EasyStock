import { X, ArrowDownRight, ArrowUpRight, ShieldCheck } from 'lucide-react';
import type { Position } from '../../types/portfolio';
import { money } from '../../utils/formatters';
import { calculateShareChange } from '../../utils/rebalance';
export function RebalanceModal({positions,total,onClose}:{positions:Position[];total:number;onClose:()=>void}) {
 const orders=positions.flatMap(p=>{const change=calculateShareChange(p,total);const qty=Math.abs(change);return qty?[{...p,qty,side:change>0?'매수':'매도'}]:[]});
 return <div className="modal-backdrop" onClick={onClose}><section className="modal" onClick={e=>e.stopPropagation()}><button className="close-button" onClick={onClose}><X size={20}/></button><span className="eyebrow">REBALANCE PREVIEW</span><h2>주문 미리보기</h2><p className="modal-desc">목표 비중에 맞춰 다음 주문을 제안합니다.</p><div className="order-list">{orders.length?orders.map(o=><div className="order-row" key={o.code}><span className={`order-icon ${o.side==='매수'?'buy':'sell'}`}>{o.side==='매수'?<ArrowUpRight size={17}/>:<ArrowDownRight size={17}/>}</span><div className="order-name"><b>{o.name}</b><small>{o.code} · {o.side}</small></div><div className="order-qty"><b>{o.qty}주</b><small>약 {money(o.qty*o.current_price)}</small></div></div>):<div className="empty-orders">현재 비중이 목표 범위에 있습니다.</div>}</div><div className="secure-note"><ShieldCheck size={18}/><span>미리보기 전용 · 실제 주문은 제출되지 않습니다.</span></div><button className="secondary-button" onClick={onClose}>확인</button></section></div>;
}
