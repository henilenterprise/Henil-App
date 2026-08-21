import { Search, X } from 'lucide-react';
import './FormField.css';
import './SearchBar.css';

function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = 'Search…',
  className = '',
  ...rest
}) {
  return (
    <div
      className={[
        'field',
        'field--has-icon-left',
        value ? 'field--has-icon-right' : '',
        'search-bar',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="field__control-wrap">
        <span className="field__icon field__icon--left">
          <Search size={16} aria-hidden="true" />
        </span>
        <input
          type="search"
          className="field__control"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          aria-label={placeholder}
          {...rest}
        />
        {value && (
          <button
            type="button"
            className="field__icon field__icon--right field__icon--clickable"
            onClick={() => onClear?.()}
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export default SearchBar;
