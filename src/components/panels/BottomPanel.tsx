import { useMemo, useState } from 'react';
import { Activity, Calculator, ChevronDown, ChevronUp, ClipboardCheck, Play, Power, RotateCcw, ScrollText, Square, Zap } from 'lucide-react';
import { useAnalysis } from '../../app/analysis';
import { useProjectStore } from '../../app/projectStore';
import { useUiStore } from '../../app/uiStore';
import { useSimStore } from '../../app/simStore';
import { getRule, VERIFICATION_LABEL } from '../../normative/registry';
import { toSnapshot, SEVERITY_ORDER } from '../../electrical/validation/validate';
import { simulateSurge } from '../../electrical/simulation/engine';
import { formatCurrent, formatNumberBR } from '../../electrical/core/units';
import type { FindingSeverity } from '../../model/schema';
import { Badge } from '../ui/primitives';

export function BottomPanel() {
  const tab = useUiStore((s) => s.bottomTab);
  const open = useUiStore((s) => s.bottomOpen);
  const set = useUiStore((s) => s.set);
  const { report } = useAnalysis();
  const logCount = useUiStore((s) => s.log.length);
  return (
    <section className={`bottom ${open ? '' : 'collapsed'}`} aria-label="Terminal de diagnóstico">
      <div className="tabs">
        <button className={tab === 'diagnostico' ? 'on' : ''} onClick={() => set({ bottomTab: 'diagnostico', bottomOpen: true })}>
          <ClipboardCheck size={14} /> Diagnóstico
          <span className={`count ${report.counts.erro ? 'err' : ''}`}>{report.counts.erro + report.counts.alerta + report.counts.inconclusivo}</span>
        </button>
        <button className={tab === 'calculos' ? 'on' : ''} onClick={() => set({ bottomTab: 'calculos', bottomOpen: true })}>
          <Calculator size={14} /> Cálculos
        </button>
        <button className={tab === 'simulacao' ? 'on' : ''} onClick={() => set({ bottomTab: 'simulacao', bottomOpen: true })}>
          <Activity size={14} /> Simulação
        </button>
        <button className={tab === 'eventos' ? 'on' : ''} onClick={() => set({ bottomTab: 'eventos', bottomOpen: true })}>
          <ScrollText size={14} /> Eventos <span className="count">{logCount}</span>
        </button>
        <div className="spacer" />
        <button onClick={() => set({ bottomOpen: !open })} title={open ? 'Recolher' : 'Expandir'} style={{ flex: 'none' }}>
          {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>
      {open && (
        <div className="scroll">
          {tab === 'diagnostico' && <Diagnostics />}
          {tab === 'calculos' && <Calculations />}
          {tab === 'simulacao' && <SimulationTab />}
          {tab === 'eventos' && <Events />}
        </div>
      )}
    </section>
  );
}

function Diagnostics() {
  const { report, project } = useAnalysis();
  const [filter, setFilter] = useState<FindingSeverity | 'todas'>('todas');
  const select = useUiStore((s) => s.select);
  const items = report.findings.filter((f) => filter === 'todas' || f.severity === filter);
  const focus = (kind: string, id: string | null) => {
    if (!id) return;
    if (kind === 'circuit' || kind === 'device' || kind === 'wire' || kind === 'comb') select({ kind, id } as never);
  };
  return (
    <div>
      <div className="statement row">
        <span className="grow">{report.statement}</span>
        <select className="select" style={{ width: 150 }} value={filter} onChange={(e) => setFilter(e.target.value as FindingSeverity | 'todas')} aria-label="Filtrar">
          <option value="todas">Todas ({report.findings.length})</option>
          {SEVERITY_ORDER.map((s) => (
            <option key={s} value={s}>
              {s} ({report.counts[s]})
            </option>
          ))}
        </select>
        <button
          className="btn sm"
          title="Registra o resultado da validação no arquivo do projeto"
          onClick={() => {
            useProjectStore.getState().storeValidation(toSnapshot(report, project));
            useUiStore.getState().toast('ok', 'Resultado da validação registrado no projeto.');
          }}
        >
          Registrar validação
        </button>
      </div>
      {items.map((f, i) => {
        const rule = getRule(f.ruleId);
        return (
          <div key={i} className="finding" onClick={() => focus(f.targetKind, f.targetId)}>
            <div>
              <Badge kind={f.severity}>{f.severity}</Badge>
            </div>
            <div>
              <div>{f.message}</div>
              {f.hint && <div className="hint">→ {f.hint}</div>}
            </div>
            <div style={{ textAlign: 'right' }} title={rule ? `${rule.title}\n${rule.source.clause}\n${VERIFICATION_LABEL[rule.verification.status]}` : ''}>
              <div className="rule">{f.ruleId}</div>
              {rule && <div className="small faint">{rule.kind === 'normativa' ? 'normativa' : 'heurística'}</div>}
            </div>
          </div>
        );
      })}
      {!items.length && <div className="empty">Nenhum item nesta categoria.</div>}
      {report.ruleErrors.length > 0 && <div className="warn-box">Falha interna em regras: {report.ruleErrors.join('; ')}</div>}
    </div>
  );
}

function Calculations() {
  const { report, project, topology } = useAnalysis();
  const select = useUiStore((s) => s.select);
  return (
    <table className="data">
      <thead>
        <tr>
          <th>Circuito</th>
          <th>Ligação</th>
          <th>P (W)</th>
          <th>cos φ</th>
          <th>Ib (A)</th>
          <th>Seção</th>
          <th>Seção mín.</th>
          <th>Iz (A)</th>
          <th>In (A)</th>
          <th>ΔU</th>
          <th>Dimensionamento</th>
          <th>Seção escolhida</th>
        </tr>
      </thead>
      <tbody>
        {project.circuits.map((c) => {
          const sz = report.ctx.sizing.get(c.id);
          const prot = report.ctx.protection.get(c.id);
          return (
            <tr key={c.id} className="clickable" onClick={() => select({ kind: 'circuit', id: c.id })}>
              <td>
                C{c.number} {c.name}
              </td>
              <td>
                {c.connection} {topology.circuits.get(c.id)?.phasesReached.filter(Boolean).join('-')}
              </td>
              <td className="num">{sz?.load ? formatNumberBR(sz.load.activeW, 0) : '—'}</td>
              <td className="num">{sz?.load ? formatNumberBR(sz.load.powerFactor, 2) : '—'}</td>
              <td className="num">{sz?.designCurrentA ? formatNumberBR(sz.designCurrentA) : '—'}</td>
              <td className="num">{c.sectionMm2 !== null ? formatNumberBR(c.sectionMm2) : '—'}</td>
              <td className="num">{sz?.minSectionMm2 != null ? formatNumberBR(sz.minSectionMm2) : '—'}</td>
              <td className="num">{sz?.chosen?.izA != null ? formatNumberBR(sz.chosen.izA, 1) : '—'}</td>
              <td className="num">{prot?.ratedCurrentA ?? '—'}</td>
              <td className="num">{sz?.chosen?.dropPct != null ? `${formatNumberBR(sz.chosen.dropPct)} %` : '—'}</td>
              <td>
                <Badge kind={sz?.sizingStatus ?? 'neutral'}>{sz?.sizingStatus ?? '—'}</Badge>
              </td>
              <td>
                <Badge kind={sz?.chosenStatus ?? 'neutral'}>{sz?.chosenStatus ?? '—'}</Badge>
              </td>
            </tr>
          );
        })}
        {!project.circuits.length && (
          <tr>
            <td colSpan={12} className="empty">
              Nenhum circuito cadastrado.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function SimulationTab() {
  const { project, snapshot, topology } = useAnalysis();
  const mode = useUiStore((s) => s.mode);
  const st = useProjectStore.getState();
  const clock = useSimStore((s) => s.clockS);
  const select = useUiStore((s) => s.select);
  const energized = project.simulation.energized;
  const tripped = project.devices.filter((d) => d.state === 'tripped');
  const [surge, setSurge] = useState(10);
  const notes = useMemo(() => [...new Set(snapshot.notes)], [snapshot.notes]);

  const toggle = () => {
    if (mode !== 'simulacao') {
      useUiStore.getState().toast('info', 'Mude para o modo Simulação para energizar.');
      return;
    }
    st.setEnergized(!energized);
    useUiStore.getState().addLog('info', energized ? 'Alimentação desligada.' : 'Alimentação energizada (simulação virtual).');
  };
  const doSurge = () => {
    const r = simulateSurge(project, topology, surge);
    const log = useUiStore.getState().addLog;
    log('warn', `Surto transitório ILUSTRATIVO de ${surge} kA (8/20 µs, modelo simplificado):`);
    r.results.forEach((x) => log(x.protectedBy.length ? 'info' : 'error', x.message));
    st.setSpdEndOfLife(r.endOfLife, true);
    if (r.endOfLife.length) log('error', `DPS em fim de vida: ${r.endOfLife.map((id) => project.devices.find((d) => d.id === id)?.label).join(', ')}`);
    useUiStore.getState().set({ bottomTab: 'eventos' });
  };

  return (
    <div className="panel-body stack">
      <div className="row wrap">
        <button className={`btn ${energized ? 'danger' : 'primary'}`} onClick={toggle} disabled={mode !== 'simulacao'}>
          {energized ? <Square size={14} /> : <Power size={14} />} {energized ? 'Desenergizar (E)' : 'Energizar (E)'}
        </button>
        <button className="btn" disabled={!tripped.length} onClick={() => st.resetTripped()}>
          <RotateCcw size={14} /> Rearmar desarmados ({tripped.length})
        </button>
        <button className="btn" disabled={!project.simulation.faults.length && !project.wires.some((w) => w.broken)} onClick={() => st.clearFaults()}>
          Limpar falhas
        </button>
        <span className="small muted">Tempo térmico ×</span>
        <select className="select" style={{ width: 80 }} value={project.simulation.timeScale} onChange={(e) => st.setTimeScale(Number(e.target.value))}>
          {[1, 5, 20, 60, 120].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="small mono muted">t = {formatNumberBR(clock, 0)} s</span>
        <div className="spacer" />
        <span className="small muted">Surto</span>
        <select className="select" style={{ width: 90 }} value={surge} onChange={(e) => setSurge(Number(e.target.value))}>
          {[5, 10, 20, 40, 60].map((n) => (
            <option key={n} value={n}>
              {n} kA
            </option>
          ))}
        </select>
        <button className="btn" onClick={doSurge} disabled={!energized}>
          <Zap size={14} /> Simular surto
        </button>
      </div>
      {mode !== 'simulacao' && <div className="info-box">Abra o modo Simulação para energizar, manobrar e injetar falhas.</div>}
      <table className="data">
        <thead>
          <tr>
            <th>Circuito</th>
            <th>Estado</th>
            <th>U carga</th>
            <th>I</th>
            <th>P</th>
            <th>U massa-terra</th>
            <th>Falhas</th>
          </tr>
        </thead>
        <tbody>
          {project.circuits.map((c) => {
            const r = snapshot.circuits.get(c.id);
            const f = project.simulation.faults.filter((x) => x.circuitId === c.id);
            return (
              <tr key={c.id} className="clickable" onClick={() => select({ kind: 'circuit', id: c.id })}>
                <td>
                  C{c.number} {c.name}
                </td>
                <td>
                  <Badge kind={r?.status === 'normal' ? 'ok' : r?.status === 'desenergizado' ? 'neutral' : 'erro'}>{r?.status ?? '—'}</Badge>
                </td>
                <td className="num">{r ? `${formatNumberBR(r.voltageV, 1)} V` : '—'}</td>
                <td className="num">{r ? formatCurrent(r.currentA) : '—'}</td>
                <td className="num">{r ? `${formatNumberBR(r.powerW, 0)} W` : '—'}</td>
                <td className="num" style={{ color: (r?.touchVoltageV ?? 0) > 50 ? 'var(--err)' : undefined }}>
                  {r ? `${formatNumberBR(r.touchVoltageV, 1)} V` : '—'}
                </td>
                <td>{f.map((x) => x.kind).join(', ') || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {notes.length > 0 && (
        <div className="small faint">
          Valores ilustrativos usados pela simulação: {notes.join(' ')}
        </div>
      )}
      <div className="small faint">
        <Play size={11} /> Resultados CALCULADOS: tensões, correntes, soma diferencial (solver nodal). ILUSTRATIVOS: tempos de atuação (modelo térmico didático), surtos e corrente no corpo humano.
      </div>
    </div>
  );
}

function Events() {
  const log = useUiStore((s) => s.log);
  const changes = useProjectStore((s) => s.changeLog);
  const [view, setView] = useState<'eventos' | 'alteracoes'>('eventos');
  return (
    <div>
      <div className="panel-body" style={{ paddingBottom: 4 }}>
        <div className="seg">
          <button className={view === 'eventos' ? 'on' : ''} onClick={() => setView('eventos')}>
            Eventos de simulação ({log.length})
          </button>
          <button className={view === 'alteracoes' ? 'on' : ''} onClick={() => setView('alteracoes')}>
            Histórico de alterações ({changes.length})
          </button>
        </div>
      </div>
      {view === 'eventos'
        ? [...log].reverse().map((l) => (
            <div key={l.id} className={`log-line ${l.kind}`}>
              [{l.at}] {l.text}
            </div>
          ))
        : [...changes].reverse().map((c, i) => (
            <div key={i} className="log-line">
              [{c.at}] {c.label}
            </div>
          ))}
      {view === 'eventos' && !log.length && <div className="empty">Sem eventos.</div>}
      {view === 'alteracoes' && !changes.length && <div className="empty">Nenhuma alteração registrada nesta sessão.</div>}
    </div>
  );
}
