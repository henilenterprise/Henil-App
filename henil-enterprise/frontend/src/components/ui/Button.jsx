import { Loader2 } from 'lucide-react';
import './Button.css';

/*
  variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size: 'sm' | 'md' | 'lg'
*/
function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  type = 'button',
  className = '',
  ...rest
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth ? 'btn--full' : '',
    loading ? 'btn--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Loader2 className="btn__spinner" size={16} aria-hidden="true" />}
      {!loading && Icon && iconPosition === 'left' && (
        <Icon className="btn__icon" size={16} aria-hidden="true" />
      )}
      <span className="btn__label">{children}</span>
      {!loading && Icon && iconPosition === 'right' && (
        <Icon className="btn__icon" size={16} aria-hidden="true" />
      )}
    </button>
  );
}

export default Button;
