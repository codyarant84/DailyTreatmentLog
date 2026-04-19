import { useState, useEffect, useRef } from 'react';

export default function SelectWithOther({ value, onChange, options, id, required, placeholder }) {
  const isCustom = value !== '' && !options.includes(value);
  const [isOther, setIsOther] = useState(isCustom);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOther && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOther]);

  function handleSelectChange(e) {
    const selected = e.target.value;
    if (selected === '__other__') {
      setIsOther(true);
      onChange('');
    } else {
      setIsOther(false);
      onChange(selected);
    }
  }

  const selectValue = isOther ? '__other__' : value;

  return (
    <>
      <select
        id={id}
        value={selectValue}
        onChange={handleSelectChange}
        required={required && !isOther}
      >
        <option value="">{placeholder || 'Select...'}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
        <option value="__other__">Other</option>
      </select>
      {isOther && (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Please specify..."
          required={required}
          style={{ marginTop: '0.5rem' }}
        />
      )}
    </>
  );
}
