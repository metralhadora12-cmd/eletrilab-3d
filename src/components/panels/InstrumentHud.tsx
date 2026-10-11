import { useState } from 'react';
import { Gauge, X } from 'lucide-react';
import { useAnalysis } from '../../app/analysis';
import { useProjectStore } from '../../app/projectStore';
import { useUiStore, type InstrumentKind } from '../../app/uiStore';
import {
  clampCircuit,
  measureResistance,
  measureVoltage,
  measureWireCurrent,
  peContinuity,
  powerMeter,
  rcdTest,
  voltageIndicator,
  type RcdTestResult,
} from '../../electrical/simulation/instruments';
import { formatCurrent, formatNumberBR, formatResistance } from '../../electrical/core/units';
import { systemVoltages } from '../../electrical/core/systems';
import { terminalDisplayName } from '../../model/terminals';
import type { Project } from '../../model/schema';

export const INSTRUMENTS: Array<{ id: InstrumentKind; label: string; help: string }> = [
  { id: 'multimetro-v', label: 'Multímetro — tensão (V~)', help: 'Clique em dois pontos (bornes ou pontos de carga). Ponta vermelha = 1º clique.' },
  { id: 'multimetro-ohm', label: 'Multímetro — resistência/continuidade', help: 'Somente com a instalação DESENERGIZADA. Clique em dois pontos.' },
  { id: 'multimetro-a', label: 'Multímetro — corrente (A~) em série', help: 'Representação: o condutor é aberto e o medidor inserido em série. Clique em um condutor.' },
  { id: 'alicate', label: 'Alicate amperímetro', help: 'Clique em um condutor do quadro ou escolha um circuito abaixo.' },
  { id: 'testador-dr', label: 'Testador de DR', help: 'Escolha o circuito; o ensaio injeta corrente fase-PE no ponto de utilização.' },
  { id: 'indicador', label: 'Indicador de tensão', help: 'Clique em um ponto: indica presença de tensão perigosa em relação à terra.' },
  { id: 'continuidade-pe', label: 'Verificador de continuidade do PE', help: 'Instalação desenergizada. Mede da massa do equipamento ao borne PE da entrada.' },
  { id: 'wattimetro', label: 'Medidor de potência', help: 'Escolha o circuito.' },
];

function probeLabel(project: Project, key: string) {
  if (key.startsWith('load:')) {
    const [, cid, part] = key.split(':');
    const c = project.circuits.find((x) => x.id === cid);
    return `Carga C${c?.number ?? '?'} · ${part === 'L1' && c?.connection === 'F-N' ? 'L' : part}`;
  }
  if (key.startsWith('wire:')) return 'Condutor selecionado';
  const [owner, terminal] = key.split('::');
  return terminalDisplayName(project, { owner, terminal });
}

export function InstrumentHud() {
  const instrument = useUiStore((s) => s.instrument);
  const probes = useUiStore((s) => s.probes);
  const clampMode = useUiStore((s) => s.clampMode);
  const set = useUiStore((s) => s.set);
  const { project, snapshot, topology } = useAnalysis();
  const [circuitId, setCircuitId] = useState<string>('');
  const [multiple, setMultiple] = useState(1);
  const [drResult, setDrResult] = useState<RcdTestResult | null>(null);
  if (!instrument) return null;
  const meta = INSTRUMENTS.find((i) => i.id === instrument)!;
  const cid = circuitId || project.circuits[0]?.id || '';
  const energized = project.simulation.energized;
  const v = systemVoltages(project.supply.systemVoltage);

  let reading: { value: string; label: string; blocked?: boolean; extra?: string } | null = null;
  const two = probes.filter((p) => !p.startsWith('wire:'));
  if (instrument === 'multimetro-v' && two.length === 2) {
    const r = measureVoltage(snapshot, two[0], two[1]);
    reading = { value: `${formatNumberBR(r.volts, 1)} V`, label: 'Tensão eficaz entre as pontas' };
  } else if (instrument === 'multimetro-ohm' && two.length === 2) {
    const r = measureResistance(project, two[0], two[1]);
    reading = r.blocked
      ? { value: 'BLOQUEADO', label: r.message, blocked: true }
      : { value: formatResistance(r.ohm), label: r.continuity ? 'Continuidade ✓ (bipe)' : 'Resistência', extra: r.note };
  } else if ((instrument === 'multimetro-a' || instrument === 'alicate') && probes[0]?.startsWith('wire:')) {
    const r = measureWireCurrent(snapshot, probes[0].slice(5));
    reading = { value: formatCurrent(r.amps), label: instrument === 'alicate' ? 'Alicate no condutor' : 'Medidor em série no condutor' };
    if (instrument === 'alicate' && r.amps > 400) reading.extra = 'Fora da faixa do alicate (sobrecarga de faixa).';
  } else if (instrument === 'indicador' && two.length >= 1) {
    const r = voltageIndicator(snapshot, two[0]);
    reading = { value: r.present ? 'TENSÃO PRESENTE' : 'sem tensão perigosa', label: `${formatNumberBR(r.volts, 0)} V em relação à terra (limiar 50 V)`, blocked: r.present };
  }

  const circuitSelect = (
    <select className="select" value={cid} onChange={(e) => setCircuitId(e.target.value)} aria-label="Circuito">
      {project.circuits.map((c) => (
        <option key={c.id} value={c.id}>
          C{c.number} — {c.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="overlay hud">
      <div className="hud-head">
        <Gauge size={16} />
        <select className="select grow" value={instrument} onChange={(e) => set({ instrument: e.target.value as InstrumentKind, probes: [] })}>
          {INSTRUMENTS.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </select>
        <button className="btn sm icon ghost" onClick={() => set({ instrument: null, tool: 'select', probes: [] })} aria-label="Fechar instrumento">
          <X size={14} />
        </button>
      </div>
      <div className="panel-body small muted">{meta.help}</div>
      {(instrument === 'multimetro-v' || instrument === 'multimetro-ohm' || instrument === 'indicador') && (
        <div className="panel-body small">
          {two.length ? two.map((p, i) => <div key={p}>{i === 0 ? '🔴' : '⚫'} {probeLabel(project, p)}</div>) : <span className="faint">Nenhuma ponta posicionada.</span>}
        </div>
      )}
      {instrument === 'alicate' && (
        <div className="panel-body stack">
          {circuitSelect}
          <div className="seg">
            <button className={clampMode === 'fase' ? 'on' : ''} onClick={() => set({ clampMode: 'fase' })}>
              Envolver a fase
            </button>
            <button className={clampMode === 'vivos' ? 'on' : ''} onClick={() => set({ clampMode: 'vivos' })}>
              Fase + neutro (sem PE)
            </button>
          </div>
          {cid && (
            <div className="meter">
              <div className="val">{formatCurrent(clampCircuit(project, snapshot, cid, clampMode).amps)}</div>
              <div className="lbl">{clampMode === 'fase' ? 'corrente de carga' : 'soma vetorial = corrente de fuga'}</div>
            </div>
          )}
        </div>
      )}
      {instrument === 'testador-dr' && (
        <div className="panel-body stack">
          {circuitSelect}
          <div className="row">
            <span className="small">Corrente de ensaio</span>
            <select className="select" value={multiple} onChange={(e) => setMultiple(Number(e.target.value))}>
              <option value={0.5}>0,5 × IΔn (não deve atuar)</option>
              <option value={1}>1 × IΔn</option>
              <option value={2}>2 × IΔn</option>
              <option value={5}>5 × IΔn</option>
            </select>
          </div>
          <button
            className="btn primary"
            disabled={!cid}
            onClick={() => {
              const r = rcdTest(project, snapshot, topology, cid, multiple);
              setDrResult(r);
              const ui = useUiStore.getState();
              ui.addLog('measure', `Testador de DR (C${project.circuits.find((c) => c.id === cid)?.number}): ${r.message}`);
              if (r.ok && r.tripped) {
                const dev = project.devices.find((d) => d.label === r.rcdLabel);
                if (dev) useProjectStore.getState().applyTrips([dev.id]);
              }
            }}
          >
            Executar ensaio
          </button>
          {drResult && (
            <div className={`meter ${drResult.ok ? '' : 'blocked'}`} style={{ textAlign: 'left' }}>
              <div className="val" style={{ fontSize: 18 }}>
                {drResult.ok ? (drResult.tripped ? 'ATUOU' : 'NÃO ATUOU') : 'ENSAIO NÃO REALIZADO'}
              </div>
              <div className="lbl" style={{ marginTop: 4 }}>
                {drResult.message}
              </div>
              {drResult.testCurrentMA !== null && <div className="lbl">I ensaio = {drResult.testCurrentMA} mA · limite: {drResult.maxTimeMs ?? '—'} ms</div>}
            </div>
          )}
        </div>
      )}
      {instrument === 'continuidade-pe' && (
        <div className="panel-body stack">
          {circuitSelect}
          {cid &&
            (() => {
              const r = peContinuity(project, cid);
              return r.blocked ? (
                <div className="meter blocked">
                  <div className="val" style={{ fontSize: 18 }}>
                    BLOQUEADO
                  </div>
                  <div className="lbl">{r.message}</div>
                </div>
              ) : (
                <div className={`meter ${Number.isFinite(r.ohm) ? '' : 'blocked'}`}>
                  <div className="val">{formatResistance(r.ohm)}</div>
                  <div className="lbl">{Number.isFinite(r.ohm) ? 'PE contínuo (massa → borne PE da entrada)' : 'PE INTERROMPIDO'}</div>
                </div>
              );
            })()}
        </div>
      )}
      {instrument === 'wattimetro' && (
        <div className="panel-body stack">
          {circuitSelect}
          {cid &&
            (() => {
              const r = powerMeter(snapshot, cid);
              return r ? (
                <div className="meter" style={{ textAlign: 'left' }}>
                  <div className="val">{formatNumberBR(r.activeW, 0)} W</div>
                  <div className="lbl">
                    {formatNumberBR(r.reactiveVar, 0)} var · {formatNumberBR(r.apparentVA, 0)} VA · FP {r.powerFactor !== null ? formatNumberBR(r.powerFactor, 3) : '—'}
                  </div>
                  <div className="lbl">
                    {formatNumberBR(r.voltageV, 1)} V · {formatCurrent(r.currentA)}
                  </div>
                </div>
              ) : null;
            })()}
        </div>
      )}
      {reading && (
        <div className={`meter ${reading.blocked ? 'blocked' : ''}`}>
          <div className="val">{reading.value}</div>
          <div className="lbl">{reading.label}</div>
          {reading.extra && <div className="lbl" style={{ marginTop: 4 }}>{reading.extra}</div>}
        </div>
      )}
      <div className="disclaimer">
        Alimentação: {project.supply.systemVoltage} V ({v.u0} V F-N / {v.u} V F-F) · {project.supply.earthing} · {energized ? 'energizada' : 'desenergizada'}. Valores calculados pelo modelo do simulador — não substituem medições com instrumentos reais calibrados.
      </div>
    </div>
  );
}
