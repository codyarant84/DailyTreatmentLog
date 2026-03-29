import { useState, useRef, useEffect } from 'react';
import './AthleteCombobox.css';

export default function AthleteCombobox({ value, onChange, athletes }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  const filtered = value
    ? athletes.filter((n) => n.toLowerCase().includes(value.toLowerCase()))
    : athletes;

  // Close on outside click
  useEffect(() => {
    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // Scroll active option into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.querySelectorAll('li')[activeIndex];
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  function handleInputChange(e) {
    onChange(e.target.value);
    setOpen(true);
    setActiveIndex(-1);
  }

  function handleSelect(name) {
    onChange(name);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && filtered[activeIndex]) {
        handleSelect(filtered[activeIndex]);
      } else {
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const showDropdown = open && filtered.length > 0;
  const showEmpty = open && value.trim() && filtered.length === 0;

  return (
    <div className="athlete-combobox" ref={containerRef}>
      <input
        type="text"
        className="form-input"
        placeholder="Search or type athlete name..."
        value={value}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
      />
      {showDropdown && (
        <ul className="combobox-list" ref={listRef} role="listbox">
          {filtered.map((name, i) => (
            <li key={name} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                className={`combobox-option${i === activeIndex ? ' combobox-option--active' : ''}`}
                onPointerDown={(e) => {
                  e.preventDefault(); // keep focus on input
                  handleSelect(name);
                }}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {showEmpty && (
        <div className="combobox-empty">No previous athletes match — new name will be added.</div>
      )}
    </div>
  );
}
