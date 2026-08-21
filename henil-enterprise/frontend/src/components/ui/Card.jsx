import './Card.css';

function Card({
  children,
  title,
  subtitle,
  actions,
  padding = 'md',
  className = '',
  ...rest
}) {
  const hasHeader = title || subtitle || actions;
  return (
    <div className={['card', `card--pad-${padding}`, className].filter(Boolean).join(' ')} {...rest}>
      {hasHeader && (
        <div className="card__header">
          <div>
            {title && <h3 className="card__title">{title}</h3>}
            {subtitle && <p className="card__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="card__actions">{actions}</div>}
        </div>
      )}
      <div className="card__body">{children}</div>
    </div>
  );
}

export default Card;
