import { useState, type FormEvent } from 'react';
import { ArrowRight, Building2, CircleHelp, KeyRound, LockKeyhole, ShieldCheck, Trash2 } from 'lucide-react';
import type { Connection } from '../../types/portfolio';

type Props = {
  connections: Connection[];
  saving: boolean;
  error: string;
  dashboardError: string;
  openingDashboard: boolean;
  onSave: (input: { broker_id: string; label: string; app_key: string; app_secret: string }) => void;
  onDashboard: () => Promise<void>;
  onSelect: (connection: Connection) => void;
  onDelete: (connection: Connection) => void;
};

export function Lobby({ connections, saving, error, dashboardError, openingDashboard, onSave, onDashboard, onSelect, onDelete }: Props) {
  const [brokerId, setBrokerId] = useState('nh_namuh');
  const [label, setLabel] = useState('내 나무 계좌');
  const [appKey, setAppKey] = useState('');
  const [appSecret, setAppSecret] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({ broker_id: brokerId, label: label.trim() || '내 나무 계좌', app_key: appKey.trim(), app_secret: appSecret.trim() });
  };

  return <div className="lobby-shell">
    <header className="lobby-topbar"><a className="brand" href="#"><span className="brand-mark"><Building2 size={20}/></span><span>easy<span>stock</span></span></a><span className="lobby-secure"><LockKeyhole size={14}/> 내 PC에 안전하게 저장</span></header>
    <main className="lobby-content">
      <section className="saved-section portfolio-manage-section"><button className="lobby-submit" type="button" onClick={() => void onDashboard()} disabled={openingDashboard}>{openingDashboard ? '포트폴리오 확인 중…' : '포트폴리오 관리하기'}<ArrowRight size={16}/></button>{dashboardError && <div className="lobby-error">{dashboardError}</div>}</section>

      {connections.length > 0 && <section className="saved-section"><div className="lobby-section-heading"><div><h2>저장된 증권사 연결</h2><p>저장된 키를 선택해 다른 계좌의 포트폴리오를 추가할 수 있습니다.</p></div></div><div className="connection-grid">{connections.map((connection) => <div className="connection-card-row" key={connection.id}><button className="connection-card" type="button" onClick={() => onSelect(connection)}><span className="broker-logo nh-logo">나무</span><span className="connection-info"><b>{connection.label}</b><small>{connection.broker_name} · 키 저장됨</small></span><ArrowRight className="connection-arrow" size={17}/></button>{connection.id !== 'env' && <button className="connection-delete" type="button" title={`${connection.label} 연결 삭제`} aria-label={`${connection.label} 연결 삭제`} onClick={() => onDelete(connection)}><Trash2 size={16}/></button>}</div>)}</div></section>}

      <section className="connect-card"><div className="connect-card-heading"><span className="form-icon"><KeyRound size={18}/></span><div><h2>증권사 계정 연결</h2><p>API 앱 키를 입력한 다음 포트폴리오를 만들 계좌를 선택합니다.</p></div></div>
        <form onSubmit={submit}>
          <label className="field-label">증권사</label><select className="lobby-input" value={brokerId} onChange={(event) => setBrokerId(event.target.value)}><option value="nh_namuh">나무증권 · NH투자증권</option><option disabled>키움증권 · 연동 준비 중</option><option disabled>한국투자증권 · 연동 준비 중</option><option disabled>미래에셋증권 · 연동 준비 중</option><option disabled>KB증권 · 연동 준비 중</option></select>
          <label className="field-label" htmlFor="profile-label">계정 이름</label><input id="profile-label" className="lobby-input" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={40} placeholder="예: 장기 투자 계정"/>
          <div className="credential-fields"><div><label className="field-label" htmlFor="nh-app-key">앱 키</label><input id="nh-app-key" className="lobby-input" value={appKey} onChange={(event) => setAppKey(event.target.value)} autoComplete="off" spellCheck={false} required placeholder="NH PLUG에서 발급한 App Key"/></div><div><label className="field-label" htmlFor="nh-app-secret">앱 시크릿</label><input id="nh-app-secret" className="lobby-input" type="password" value={appSecret} onChange={(event) => setAppSecret(event.target.value)} autoComplete="new-password" required placeholder="App Secret Key"/></div></div>
          {error && <div className="lobby-error">{error}</div>}
          <button className="lobby-submit" type="submit" disabled={saving || !appKey || !appSecret}>{saving ? '보안 저장소에 저장 중…' : '안전하게 저장하고 연결'}<ArrowRight size={16}/></button>
        </form>
        <div className="security-note"><ShieldCheck size={16}/><span>키와 시크릿은 브라우저에 저장하지 않습니다. 이 PC의 Windows 자격 증명 관리자에 저장됩니다.</span></div>
      </section>
      <div className="lobby-help"><CircleHelp size={15}/><span>앱 키는 NH투자증권 NAMUH PLUG 포털에서 발급할 수 있습니다. 키가 올바르더라도 API 사용 신청과 계좌 연결 권한이 필요합니다.</span></div>
    </main>
    <footer className="lobby-footer">개인 계좌 연결 정보는 이 컴퓨터의 EasyStock 백엔드에서 관리됩니다.</footer>
  </div>;
}
