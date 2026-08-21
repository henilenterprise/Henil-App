import { useMemo, useState } from 'react';
import Select from '../ui/Select.jsx';
import './NestingVisualMap.css';

const PALETTE = ['#c9a227', '#4d7ea8', '#8a5a8f', '#5f9e6e', '#c76b4f', '#7a7a7a', '#b0763e', '#4d8a8a'];

/*
  Renders one sheet's part placements to scale, proportional to the
  real sheet dimensions. Each distinct part name gets a consistent
  color across the whole map. A dropdown switches between sheets when
  a job needed more than one.
*/
function NestingVisualMap({ sheetWidth, sheetHeight, placements, sheetsRequired }) {
  const [sheetIndex, setSheetIndex] = useState(0);

  const colorByName = useMemo(() => {
    const names = Array.from(new Set(placements.map((p) => p.name)));
    const map = new Map();
    names.forEach((name, i) => map.set(name, PALETTE[i % PALETTE.length]));
    return map;
  }, [placements]);

  const thisSheetPlacements = placements.filter((p) => p.sheetIndex === sheetIndex);

  // SVG viewBox matches the real sheet aspect ratio exactly, so the
  // rendered map is proportional to actual dimensions, not stretched.
  const viewBoxW = 600;
  const viewBoxH = (sheetHeight / sheetWidth) * viewBoxW;
  const scale = viewBoxW / sheetWidth;

  return (
    <div className="nesting-map">
      {sheetsRequired > 1 && (
        <div className="nesting-map__selector">
          <Select
            aria-label="Select sheet"
            value={String(sheetIndex)}
            onChange={(e) => setSheetIndex(Number(e.target.value))}
            options={Array.from({ length: sheetsRequired }, (_, i) => ({ value: String(i), label: `Sheet ${i + 1} of ${sheetsRequired}` }))}
          />
        </div>
      )}
      <svg viewBox={`0 0 ${viewBoxW} ${viewBoxH}`} className="nesting-map__svg" role="img" aria-label={`Cutting layout for sheet ${sheetIndex + 1}`}>
        <rect x={0} y={0} width={viewBoxW} height={viewBoxH} fill="#fafaf9" stroke="#0a0a0a" strokeWidth={2} />
        {thisSheetPlacements.map((p, i) => (
          <g key={i}>
            <rect
              x={p.x * scale}
              y={p.y * scale}
              width={p.w * scale}
              height={p.h * scale}
              fill={colorByName.get(p.name)}
              fillOpacity={0.75}
              stroke="#0a0a0a"
              strokeWidth={1}
            />
            {p.w * scale > 30 && p.h * scale > 14 && (
              <text
                x={p.x * scale + (p.w * scale) / 2}
                y={p.y * scale + (p.h * scale) / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fill="#0a0a0a"
              >
                {p.name}
                {p.rotated ? ' \u21bb' : ''}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="nesting-map__legend">
        {Array.from(colorByName.entries()).map(([name, color]) => (
          <span key={name} className="nesting-map__legend-item">
            <span className="nesting-map__legend-swatch" style={{ backgroundColor: color }} />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default NestingVisualMap;
