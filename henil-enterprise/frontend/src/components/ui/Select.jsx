import { useId } from 'react';
import { AlertCircle } from 'lucide-react';
import './FormField.css';

function Select({
  label,
  helperText,
  error,
  required = false,
  options = [],
  placeholder = 'Select an option',
  className = '',
  id,
  value,
  defaultValue,
  ...rest
}) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const hasError = Boolean(error);

  const chevron =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234D4D4D' stroke-width='1.5' fill='none' fill-rule='evenodd' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

  // Controlled (`value` passed) and uncontrolled usage both need to
  // work without ever putting both `value` and `defaultValue` on the
  // <select> at once, which React warns about and gets confused by.
  const valueProps =
    value !== undefined ? { value } : { defaultValue: defaultValue ?? '' };

  const hasOwnBlankOption = options.some((opt) => opt.value === '');

  return (
    <div className={['field', hasError ? 'field--error' : '', className].filter(Boolean).join(' ')}>
      {label && (
        <label className="field__label" htmlFor={selectId}>
          {label}
          {required && <span className="field__required">*</span>}
        </label>
      )}
      <div className="field__control-wrap">
        <select
          id={selectId}
          className="field__control"
          style={{ backgroundImage: chevron }}
          aria-invalid={hasError || undefined}
          {...valueProps}
          {...rest}
        >
          {!hasOwnBlankOption && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {hasError ? (
        <span className="field__error">
          <AlertCircle size={13} aria-hidden="true" />
          {error}
        </span>
      ) : helperText ? (
        <span className="field__helper">{helperText}</span>
      ) : null}
    </div>
  );
}

export default Select;
