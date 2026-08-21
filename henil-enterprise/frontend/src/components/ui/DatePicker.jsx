import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import './FormField.css';
import './DatePicker.css';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDate(date) {
  if (!date) return '';
  return `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}, ${date.getFullYear()}`;
}

function buildCalendarGrid(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
  return cells;
}

function DatePicker({ label, value, onChange, helperText, error, placeholder = 'Select date', required = false }) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [viewDate, setViewDate] = useState(value ? toDateOnly(value) : toDateOnly(new Date()));
  const rootRef = useRef(null);
  const hasError = Boolean(error);
  const today = toDateOnly(new Date());

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mobile fix: a left-anchored popover positioned near the right
  // edge of the viewport (very common — e.g. the "To" field in a
  // From/To filter row) would otherwise render partially or fully
  // off-screen. Measure against the actual popover width (which
  // itself is capped by min() in CSS, so this stays correct even on
  // the narrowest phones) rather than a hardcoded number.
  useEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(280, window.innerWidth - 32);
    const wouldOverflowRight = rect.left + popoverWidth > window.innerWidth - 16;
    setAlignRight(wouldOverflowRight);
  }, [open]);

  const cells = buildCalendarGrid(viewDate);

  return (
    <div className={['field', hasError ? 'field--error' : '', 'field--has-icon-left'].join(' ')} ref={rootRef}>
      {label && (
        <label className="field__label">
          {label}
          {required && <span className="field__required">*</span>}
        </label>
      )}
      <div className="field__control-wrap">
        <span className="field__icon field__icon--left">
          <Calendar size={16} aria-hidden="true" />
        </span>
        <button
          type="button"
          className="field__control datepicker__trigger"
          onClick={() => setOpen((v) => !v)}
        >
          {value ? formatDate(value) : <span className="datepicker__placeholder">{placeholder}</span>}
        </button>
      </div>

      {open && (
        <div className={`datepicker__popover${alignRight ? ' datepicker__popover--right' : ''}`}>
          <div className="datepicker__header">
            <button
              type="button"
              className="datepicker__nav"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="datepicker__month-label">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              className="datepicker__nav"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="datepicker__weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </div>

          <div className="datepicker__grid">
            {cells.map((cell, i) => {
              if (!cell) return <span key={`empty-${i}`} />;
              const isSelected = value && toDateOnly(value).getTime() === cell.getTime();
              const isToday = cell.getTime() === today.getTime();
              return (
                <button
                  type="button"
                  key={cell.toISOString()}
                  className={[
                    'datepicker__day',
                    isSelected ? 'datepicker__day--selected' : '',
                    isToday && !isSelected ? 'datepicker__day--today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    onChange?.(cell);
                    setOpen(false);
                  }}
                >
                  {cell.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasError ? (
        <span className="field__error">{error}</span>
      ) : helperText ? (
        <span className="field__helper">{helperText}</span>
      ) : null}
    </div>
  );
}

export default DatePicker;
