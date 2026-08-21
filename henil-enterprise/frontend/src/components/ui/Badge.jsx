import './Badge.css';

/*
  tone: 'neutral' | 'gold' | 'success' | 'warning' | 'danger' | 'info'
*/
function Badge({ children, tone = 'neutral', dot = false, className = '' }) {
  return (
    <span className={['badge', `badge--${tone}`, className].filter(Boolean).join(' ')}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  );
}

export default Badge;
