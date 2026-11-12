import { ArrowUpRight, Wallet } from 'lucide-react';
import { money } from '../../utils/formatters';
export function RightSlidePanel({ cash, budget, onRebalance }: { cash:number; budget:number; onRebalance:()=>void }) {
  return <aside className="side-panel">
    <div className="side-title"><span className="wallet-icon"><Wallet size={18}/></span><h3>내 계좌 요약</h3><span className="live-dot"/></div>
    <p className="account-label">NAMUH · 종합매매</p>
    <div className="balance-block"><span>총 투자 자산</span><strong>{money(budget)}</strong><small><ArrowUpRight size={14}/> 오늘 +1.24%</small></div>
    <div className="cash-track"><i style={{width:`${Math.min(cash/budget*100,100)}%`}}/></div>
    <p className="cash-caption">현금 비중 <b>{(cash/budget*100).toFixed(1)}%</b></p>
    <div className="panel-divider"/>
    <button className="primary-button" onClick={onRebalance}>리밸런싱 미리보기 <ArrowUpRight size={17}/></button>
    <p className="fine-print">주문 확인 전에는 거래가 실행되지 않습니다.</p>
  </aside>;
}
