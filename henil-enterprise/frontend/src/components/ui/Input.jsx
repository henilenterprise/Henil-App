import { useId } from 'react';
import { AlertCircle } from 'lucide-react';
import './FormField.css';

function Input({
  label,
  helperText,
  error,
  required = false,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  id,
  ...rest
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const hasError = Boolean(error);

  const wrapClasses = [
    'field',
    hasError ? 'field--error' : '',
    Icon && iconPosition === 'left' ? 'field--has-icon-left' : '',
    Icon && iconPosition === 'right' ? 'field--has-icon-right' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapClasses}>
      {label && (
        <label className="field__label" htmlFor={inputId}>
          {label}
          {required && <span className="field__required">*</span>}
        </label>
      )}
      <div className="field__control-wrap">
        {Icon && iconPosition === 'left' && (
          <span className="field__icon field__icon--left">
            <Icon size={16} aria-hidden="true" />
          </span>
        )}
        <input
          id={inputId}
          className="field__control"
          aria-invalid={hasError || undefined}
          aria-describedby={
            hasError ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
          }
          {...rest}
        />
        {Icon && iconPosition === 'right' && (
          <span className="field__icon field__icon--right">
            <Icon size={16} aria-hidden="true" />
          </span>
        )}
      </div>
      {hasError ? (
        <span className="field__error" id={`${inputId}-error`}>
          <AlertCircle size={13} aria-hidden="true" />
          {error}
        </span>
      ) : helperText ? (
        <span className="field__helper" id={`${inputId}-helper`}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
}

export default Input;
