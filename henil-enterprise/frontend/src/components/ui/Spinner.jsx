import './Spinner.css';

/*
  size: 'sm' | 'md' | 'lg'
*/
function Spinner({ size = 'md', label, inline = false }) {
  return (
    <div className={`spinner-wrap ${inline ? 'spinner-wrap--inline' : ''}`} role="status" aria-live="polite">
      <span className={`spinner spinner--${size}`} aria-hidden="true" />
      {label && <span className="spinner__label">{label}</span>}
      <span className="visually-hidden">{label || 'Loading'}</span>
    </div>
  );
}

export default Spinner;
