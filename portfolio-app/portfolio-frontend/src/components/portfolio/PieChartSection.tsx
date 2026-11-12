import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useMemo } from 'react';
import type { Position } from '../../types/portfolio';
const COLORS = ['#5b67f1','#20b89a','#f6a943','#e878a9','#45a3d9'];
export function PieChartSection({ positions, cash }: { positions: Position[]; cash: number }) {
  const { actual, target } = useMemo(() => {
    const accountPositions = positions.filter((position) => !position.is_planned);
    const includedPositions = positions.filter((position) => position.is_in_portfolio);
    const unlistedPositions = accountPositions.filter((position) => !position.is_in_portfolio);
    const unlistedValue = unlistedPositions.reduce((sum, position) => sum + position.quantity * position.current_price, 0);
    const accountValue = accountPositions.reduce((sum, position) => sum + position.quantity * position.current_price, 0);
    const accountTotal = accountValue + cash;
    const actual = [
      ...accountPositions.filter((position) => position.is_in_portfolio).map((position) => ({ name: position.name, value: accountTotal ? position.quantity * position.current_price / accountTotal * 100 : 0 })),
      ...(unlistedValue > 0 && accountTotal > 0 ? [{ name: '미포함 종목', value: unlistedValue / accountTotal * 100 }] : []),
    ];
    const target = [
      ...includedPositions.map((position) => ({ name: position.name, value: position.target_weight })),
      ...(unlistedPositions.length ? [{ name: '미포함 종목', value: unlistedPositions.reduce((sum, position) => sum + position.target_weight, 0) }] : []),
    ];
    return { actual, target };
  }, [positions, cash]);
  return <section className="charts-grid">{[{title:'목표 자산 배분',data:target,caption:'계획 종목과 미포함 종목'},{title:'현재 자산 배분',data:actual,caption:'실계좌 잔고 기준'}].map(chart => <article className="card chart-card" key={chart.title}><div className="card-heading"><div><h3>{chart.title}</h3><p>{chart.caption}</p></div><span className="more">•••</span></div><div className="chart-body"><div className="pie-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chart.data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={4} stroke="none">{chart.data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={(v:number)=>`${v.toFixed(1)}%`}/></PieChart></ResponsiveContainer><div className="pie-center"><b>{chart.data.length}</b><span>항목</span></div></div><div className="legend">{chart.data.length ? chart.data.map((item,i)=><div className="legend-row" key={item.name}><i style={{background:COLORS[i%COLORS.length]}}/><span>{item.name}</span><b>{item.value.toFixed(1)}%</b></div>) : <div className="empty-orders">표시할 잔고가 없습니다.</div>}</div></div></article>)}</section>;
}
