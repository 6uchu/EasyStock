import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { money } from '../../utils/formatters';

export function BudgetModal({ value, onClose, onSave, subject = '예산' }: { value: number; onClose: () => void; onSave: (value: number) => void; subject?: string }) {
  const [budget, setBudget] = useState(Math.round(value).toLocaleString('en-US'));
  const [adjustment, setAdjustment] = useState('');
  const amountValue = (formatted: string) => Number(formatted.replaceAll(',', ''));
  const handleAmountInput = (event: ChangeEvent<HTMLInputElement>, setter: (value: string) => void) => {
    const input = event.currentTarget;
    const caret = input.selectionStart ?? input.value.length;
    const digitsBeforeCaret = input.value.slice(0, caret).replace(/\D/g, '').length;
    const digits = input.value.replace(/\D/g, '');
    const formatted = digits ? Number(digits).toLocaleString('en-US') : '';
    setter(formatted);
    requestAnimationFrame(() => {
      let nextCaret = 0;
      let seenDigits = 0;
      while (nextCaret < formatted.length && seenDigits < digitsBeforeCaret) {
        if (/\d/.test(formatted[nextCaret])) seenDigits += 1;
        nextCaret += 1;
      }
      if (formatted[nextCaret] === ',') nextCaret += 1;
      input.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const applyAdjustment = (direction: 1 | -1) => {
    const current = amountValue(budget);
    const delta = amountValue(adjustment);
    if (!Number.isFinite(current) || !Number.isFinite(delta) || delta <= 0) return;
    setBudget(Math.max(0, current + delta * direction).toLocaleString('en-US'));
  };

  const addAdjustment = (amount: number) => {
    setAdjustment(((amountValue(adjustment) || 0) + amount).toLocaleString('en-US'));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = amountValue(budget);
    if (Number.isFinite(parsed) && parsed >= 0) onSave(Math.round(parsed));
  };

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal budget-modal" role="dialog" aria-modal="true" aria-label={`${subject} 조정`}>
      <button type="button" className="close-button" aria-label="닫기" onClick={onClose}><X size={19}/></button>
      <form onSubmit={submit}>
        <label className="budget-field-label" htmlFor="budget-value">{subject}</label>
        <div className="budget-current-field"><input id="budget-value" autoFocus required type="text" inputMode="numeric" value={budget} onChange={(event) => handleAmountInput(event, setBudget)}/><span>원</span></div>
        <label className="budget-field-label" htmlFor="budget-adjustment">조정 금액</label>
        <div className="budget-adjust-row"><input id="budget-adjustment" type="text" inputMode="numeric" placeholder="조정할 금액 입력" value={adjustment} onChange={(event) => handleAmountInput(event, setAdjustment)}/><button type="button" aria-label="조정 금액 더하기" title="더하기" disabled={!adjustment || amountValue(adjustment) <= 0} onClick={() => applyAdjustment(1)}><Plus size={17}/></button><button type="button" aria-label="조정 금액 빼기" title="빼기" disabled={!adjustment || amountValue(adjustment) <= 0} onClick={() => applyAdjustment(-1)}><Minus size={17}/></button></div>
        <div className="budget-denomination-buttons" aria-label="조정 금액 빠른 입력">{[{label:'백만원', amount:1000000}, {label:'십만원', amount:100000}, {label:'만원', amount:10000}, {label:'천원', amount:1000}].map(({label, amount}) => <button type="button" key={amount} onClick={() => addAdjustment(amount)}>+{label}</button>)}</div>
        <p className="budget-preview">저장할 {subject} <b>{money(amountValue(budget) || 0)}</b></p>
        <div className="budget-modal-actions"><button type="button" className="budget-cancel" onClick={onClose}>취소</button><button type="submit" className="secondary-button">저장</button></div>
      </form>
    </section>
  </div>;
}
