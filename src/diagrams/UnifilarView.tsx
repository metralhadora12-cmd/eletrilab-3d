/** Renderização SVG do diagrama unifilar, sincronizada com a montagem. */
import { useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Download, Maximize, Printer } from 'lucide-react';
import { useAnalysis } from '../app/analysis';
import { useUiStore } from '../app/uiStore';
import { buildUnifilar, type DiagramNode, type UnifilarDiagram } from './unifilar';
import { downloadText, safeFileName } from '../components/download';
import { PROJECT_DISCLAIMER } from '../persistence/serialize';

const INK = '#1d232b';
const RED = '#c62828';

function BreakerSymbol({ rcd, color }: { rcd?: boolean; color: string }) {
  return (
    <g stroke={color} strokeWidth={2} fill="none">
      <line x1={0} y1={-30} x2={0} y2={-12} />
      <line x1={0} y1={12} x2={0} y2={30} />
      <line x1={0} y1={12} x2={-11} y2={-10} />
      <line x1={-4} y1={-16} x2={4} y2={-8} />
      <line x1={4} y1={-16} x2={-4} y2={-8} />
      {rcd && (
        <>
          <ellipse cx={0} cy={20} rx={11} ry={4} />
          <text x={-28} y={24} fontSize={10} fill={color} stroke="none" fontFamily="Segoe UI, Arial">
            IΔ
          </text>
        </>
      )}
    </g>
  );
}

function SpdSymbol({ color }: { color: string }) {
  return (
    <g stroke={color} strokeWidth={2} fill="none">
      <line x1={0} y1={-30} x2={0} y2={-14} />
      <rect x={-9} y={-14} width={18} height={26} />
      <polyline points="-5,6 0,-2 -3,-2 2,-10" />
      <line x1={0} y1={12} x2={0} y2={22} />
      <line x1={-11} y1={22} x2={11} y2={22} />
      <line x1={-7} y1={26} x2={7} y2={26} />
      <line x1={-3} y1={30} x2={3} y2={30} />
    </g>
  );
}

function NodeView({ n, selected, onSelect }: { n: DiagramNode; selected: boolean; onSelect: (n: DiagramNode) => void }) {
  const tripped = n.state === 'tripped';
  const off = n.state === 'off';
  const color = !n.connected ? '#8a8a8a' : tripped ? RED : INK;
  return (
    <g transform={`translate(${n.x},${n.y})`} onClick={() => onSelect(n)} style={{ cursor: n.refId ? 'pointer' : 'default' }}>
      {selected && <rect x={-60} y={-38} width={120} height={n.kind === 'circuit' ? 118 : 76} rx={6} fill="rgba(61,139,253,0.12)" stroke="#3d8bfd" strokeDasharray="4 3" />}
      {n.kind === 'supply' && (
        <g>
          <circle r={18} fill="#fff" stroke={INK} strokeWidth={2} />
          <text y={6} textAnchor="middle" fontSize={18} fill={INK}>
            ~
          </text>
          <line x1={0} y1={18} x2={0} y2={30} stroke={INK} strokeWidth={2} />
        </g>
      )}
      {(n.kind === 'breaker' || n.kind === 'rcd') && <BreakerSymbol rcd={n.kind === 'rcd'} color={color} />}
      {n.kind === 'spd' && <SpdSymbol color={color} />}
      {n.kind === 'circuit' && (
        <g stroke={color} strokeWidth={2} fill="#fff">
          <line x1={0} y1={-30} x2={0} y2={4} />
          <polygon points="-6,4 6,4 0,14" fill={color} />
          <circle cy={26} r={11} />
          <line x1={-7} y1={19} x2={7} y2={33} />
          <line x1={7} y1={19} x2={-7} y2={33} />
        </g>
      )}
      <g fontFamily="Segoe UI, Arial, sans-serif" fill={color}>
        {n.kind === 'circuit' ? (
          <>
            <text y={54} textAnchor="middle" fontSize={11.5} fontWeight={700}>
              {n.label.length > 24 ? `${n.label.slice(0, 23)}…` : n.label}
            </text>
            {n.details.map((d, i) => (
              <text key={i} y={68 + i * 12} textAnchor="middle" fontSize={10} fill="#444">
                {d}
              </text>
            ))}
          </>
        ) : n.kind === 'supply' ? (
          <>
            <text x={26} y={-6} fontSize={12} fontWeight={700}>
              {n.label}
            </text>
            {n.details.map((d, i) => (
              <text key={i} x={26} y={8 + i * 12} fontSize={10} fill="#444">
                {d}
              </text>
            ))}
          </>
        ) : (
          <>
            <text x={16} y={-8} fontSize={12} fontWeight={700}>
              {n.label}
              {tripped ? ' (desarmado)' : off ? ' (desligado)' : ''}
            </text>
            {n.details.map((d, i) => (
              <text key={i} x={16} y={6 + i * 12} fontSize={10} fill="#444">
                {d}
              </text>
            ))}
          </>
        )}
      </g>
    </g>
  );
}

function DiagramContent({ d, selectedRef, onSelect }: { d: UnifilarDiagram; selectedRef: string | null; onSelect: (n: DiagramNode) => void }) {
  const unY = d.unconnected[0]?.y;
  return (
    <g>
      <text x={20} y={26} fontSize={15} fontWeight={700} fill={INK} fontFamily="Segoe UI, Arial">
        Diagrama unifilar — {d.title}
      </text>
      <text x={20} y={44} fontSize={10.5} fill={RED} fontFamily="Segoe UI, Arial">
        {PROJECT_DISCLAIMER}
      </text>
      {d.edges.map((e, i) => (
        <polyline key={i} points={e.points.map((p) => p.join(',')).join(' ')} fill="none" stroke={INK} strokeWidth={2} />
      ))}
      {d.nodes.map((n) => (
        <NodeView key={n.id} n={n} selected={!!n.refId && n.refId === selectedRef} onSelect={onSelect} />
      ))}
      {d.unconnected.length > 0 && (
        <>
          <text x={20} y={unY - 52} fontSize={12} fontWeight={700} fill="#8a8a8a" fontFamily="Segoe UI, Arial">
            Elementos sem alimentação (verifique as ligações):
          </text>
          {d.unconnected.map((n) => (
            <NodeView key={n.id} n={n} selected={!!n.refId && n.refId === selectedRef} onSelect={onSelect} />
          ))}
        </>
      )}
    </g>
  );
}

export function UnifilarView() {
  const { project, topology, report } = useAnalysis();
  const diagram = useMemo(() => buildUnifilar(project, topology, report.ctx.sizing), [project, topology, report]);
  const selection = useUiStore((s) => s.selection);
  const select = useUiStore((s) => s.select);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const onSelect = (n: DiagramNode) => {
    if (!n.refId) return;
    select({ kind: n.kind === 'circuit' ? 'circuit' : 'device', id: n.refId });
    useUiStore.getState().set({ rightOpen: true });
  };
  const fit = () => {
    const el = wrap.current;
    if (!el) return;
    const k = Math.min(el.clientWidth / diagram.width, el.clientHeight / diagram.height, 1.6);
    setView({ x: (el.clientWidth - diagram.width * k) / 2, y: 10, k });
  };
  const exportSvg = () => {
    const markup = renderToStaticMarkup(
      <svg xmlns="http://www.w3.org/2000/svg" width={diagram.width} height={diagram.height} viewBox={`0 0 ${diagram.width} ${diagram.height}`}>
        <rect width="100%" height="100%" fill="#ffffff" />
        <DiagramContent d={diagram} selectedRef={null} onSelect={() => undefined} />
      </svg>,
    );
    downloadText(`${safeFileName(project.name)}-unifilar.svg`, `<?xml version="1.0" encoding="UTF-8"?>\n<!-- ${PROJECT_DISCLAIMER} -->\n${markup}`, 'image/svg+xml');
  };
  const exportPdf = () => {
    const markup = renderToStaticMarkup(
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${diagram.width} ${diagram.height}`} style={{ width: '100%', height: 'auto' }}>
        <DiagramContent d={diagram} selectedRef={null} onSelect={() => undefined} />
      </svg>,
    );
    const w = window.open('', '_blank');
    if (!w) {
      useUiStore.getState().toast('warn', 'Permita janelas pop-up para gerar o PDF (impressão).');
      return;
    }
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${project.name} — diagrama unifilar (didático)</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Segoe UI,Arial;margin:0}p{color:#c62828;font-size:11px}</style></head><body>${markup}<p>${PROJECT_DISCLAIMER}</p><script>window.onload=()=>{window.print()}</script></body></html>`,
    );
    w.document.close();
  };

  return (
    <div
      ref={wrap}
      className="diagram-wrap"
      onWheel={(e) => {
        const rect = wrap.current!.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const k = Math.max(0.25, Math.min(4, view.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
        setView({ k, x: mx - ((mx - view.x) * k) / view.k, y: my - ((my - view.y) * k) / view.k });
      }}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        setView({ ...view, x: drag.current.vx + e.clientX - drag.current.x, y: drag.current.vy + e.clientY - drag.current.y });
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
    >
      <svg role="img" aria-label="Diagrama unifilar">
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          <DiagramContent d={diagram} selectedRef={selection?.id ?? null} onSelect={onSelect} />
        </g>
      </svg>
      <div className="overlay" style={{ right: 10, top: 10, display: 'flex', gap: 6 }}>
        <button className="btn sm" onClick={fit} title="Ajustar à tela">
          <Maximize size={13} /> Ajustar
        </button>
        <button className="btn sm" onClick={exportSvg}>
          <Download size={13} /> SVG
        </button>
        <button className="btn sm" onClick={exportPdf}>
          <Printer size={13} /> PDF
        </button>
      </div>
      <div className="overlay small" style={{ left: 10, bottom: 10, color: '#555', background: 'rgba(255,255,255,.85)', padding: '4px 8px', borderRadius: 6 }}>
        Clique em um elemento para selecioná-lo no quadro · roda do mouse = zoom · arraste = mover
      </div>
    </div>
  );
}
