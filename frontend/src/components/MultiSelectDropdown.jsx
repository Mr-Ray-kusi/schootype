import React from 'react';
import { X } from 'lucide-react';

const uniqueValues = (values) => {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = String(value || '').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
};

const MultiSelectDropdown = ({
  label,
  options = [],
  selected = [],
  onChange,
  placeholder = 'Select…',
  emptyHint,
}) => {
  const selectedValues = uniqueValues(selected);
  const optionValues = uniqueValues([...options, ...selectedValues]);
  const available = optionValues.filter(
    (value) => !selectedValues.some((item) => item.toLowerCase() === value.toLowerCase())
  );

  return (
    <div>
      {label ? (
        <label className="mb-2 block text-sm font-medium text-slate-200">{label}</label>
      ) : null}

      {selectedValues.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedValues.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                onChange(selectedValues.filter((item) => item.toLowerCase() !== value.toLowerCase()))
              }
              className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/15 px-3 py-1 text-sm text-sky-100 hover:bg-sky-500/25"
            >
              {value}
              <X className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      ) : null}

      <select
        value=""
        onChange={(event) => {
          const value = event.target.value;
          if (!value) return;
          if (selectedValues.some((item) => item.toLowerCase() === value.toLowerCase())) return;
          onChange([...selectedValues, value]);
        }}
        className="w-full rounded-lg border border-slate-500 bg-slate-900 px-4 py-2 text-slate-50"
        disabled={optionValues.length === 0}
      >
        <option value="">{optionValues.length === 0 ? 'Nothing to select yet' : placeholder}</option>
        {available.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>

      {optionValues.length === 0 && emptyHint ? (
        <p className="mt-1 text-xs text-amber-300">{emptyHint}</p>
      ) : (
        <p className="mt-1 text-xs text-slate-400">Select one, then add another from the same list.</p>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
