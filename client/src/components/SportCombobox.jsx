import { useState, useRef, useEffect } from 'react';
import './AthleteCombobox.css'; // reuse same dropdown styles

export const SPORTS = [
  'Football',
  'Basketball (Men\'s)',
  'Basketball (Women\'s)',
  'Baseball',
  'Softball',
  'Soccer (Men\'s)',
  'Soccer (Women\'s)',
  'Volleyball',
  'Track & Field',
  'Cross Country',
  'Swimming',
  'Tennis',
  'Golf',
  'Wrestling',
  'Cheerleading',
  'Other',
];

export default function SportCombobox({ value, onChange }) {
  const [inputVal, setInputVal] = useState(value ?? '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  // Keep internal input in sync when value is reset externally (e.g. "Log Another")
  useEffect(() => { setInputVal(value ?? ''); }, [value]);

  const filtered = inputVal
    ? SPORTS.filter((s) => s.toLowerCase().includes(inputVal.toLowerCase()))
    : SPORTS;

  useEffect(() => {
    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        commitOrReset();
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [inputVal]);

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      listRef.current.querySelectorAll('li')[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  function commitOrReset() {
    // Accept only values exactly in the SPORTS list (case-insensitive)
    const match = SPORTS.find((s) => s.toLowerCase() === inputVal.toLowerCase());
    if (match) {
      setInputVal(match);
      onChange(match);
    } else {
      setInputVal(value ?? '');
    }
  }

  function handleSelect(sport) {
    setInputVal(sport);
    onChange(sport);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { setOpen(true); return; }
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
      } else if (filtered.length === 1) {
        handleSelect(filtered[0]);
      } else {
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const showDropdown = open && filtered.length > 0;

  return (
    <div className="athlete-combobox" ref={containerRef}>
      <input
        type="text"
        className="form-input"
        placeholder="Search sport..."
        value={inputVal}
        onChange={(e) => { setInputVal(e.target.value); setOpen(true); setActiveIndex(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
      />
      {showDropdown && (
        <ul className="combobox-list" ref={listRef} role="listbox">
          {filtered.map((sport, i) => (
            <li key={sport} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                className={`combobox-option${i === activeIndex ? ' combobox-option--active' : ''}`}
                onPointerDown={(e) => { e.preventDefault(); handleSelect(sport); }}
              >
                {sport}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
