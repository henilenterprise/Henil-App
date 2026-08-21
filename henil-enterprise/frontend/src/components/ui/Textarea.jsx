import { useId } from 'react';
import { AlertCircle } from 'lucide-react';
import './FormField.css';

function Textarea({
  label,
  helperText,
  error,
  required = false,
  rows = 4,
  className = '',
  id,
  ...rest
}) {
  const generatedId = useId();
  const textareaId = id || generatedId;
  const hasError = Boolean(error);

  return (
    <div className={['field', hasError ? 'field--error' : '', className].filter(Boolean).join(' ')}>
      {label && (
        <label className="field__label" htmlFor={textareaId}>
          {label}
          {required && <span className="field__required">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        className="field__control"
        rows={rows}
        aria-invalid={hasError || undefined}
        {...rest}
      />
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

export default Textarea;
