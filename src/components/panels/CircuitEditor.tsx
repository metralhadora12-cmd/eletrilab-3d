import { useState } from 'react';
import { Copy, ListTree, Plus, Trash2, TriangleAlert, X } from 'lucide-react';
import { useProjectStore } from '../../app/projectStore';
import { useUiStore } from '../../app/uiStore';
import { useAnalysis } from '../../app/analysis';
import type { Circuit, CircuitConnection, InstallationMethod, Location } from '../../model/schema';
import { AVAILABLE_SECTIONS_MM2 } from '../../catalog/conductors';
import { CONNECTION_LABEL, supplySupportsConnection } from '../../electrical/core/systems';
import { formatCurrent, formatNumberBR } from '../../electrical/core/units';
import { Badge, Field, Kv, NumberInput, Section, Select, TextInput } from '../ui/primitives';
import { KIND_LABEL } from './LeftPanel';

const LOCATION_LABEL: Record<Location, string> = {
  sala: 'Sala',
  quarto: 'Quarto',
  circulacao: 'Circulação',
  escritorio: 'Escritório',
  banheiro: 'Banheiro (chuveiro/banheira)',
  cozinha: 'Cozinha / copa',
  'area-servico': 'Área de serviço',
  lavanderia: 'Lavanderia',
  garagem: 'Garagem',
  'area-externa': 'Área externa',
  outro: 'Outro',
};

const METHOD_LABEL: Record<InstallationMethod, string> = {
  A1: 'A1 — condutores isolados em eletroduto em parede termicamente isolante',
  A2: 'A2 — cabo multipolar em eletroduto em parede termicamente isolante',
  B1: 'B1 — condutores isolados em eletroduto (embutido em alvenaria ou aparente)',
  C: 'C — cabo unipolar/multipolar fixado diretamente em parede',
  B2: 'B2 — (não incluído no conjunto de dados)',
};

const STATUS_KIND: Record<string, string> = { ok: 'ok', falha: 'falha', inconclusivo: 'inconclusivo', 'nao-avaliado': 'nao-avaliado' };

export function CircuitEditor({ circuit: c }: { circuit: Circuit }) {
  const st = useProjectStore.getState();
  const supply = useProjectStore((s) => s.project.supply);
  const mode = useUiStore((s) => s.mode);
  const { report, topology, snapshot, project } = useAnalysis();
  const sz = report.ctx.sizing.get(c.id);
  const prot = report.ctx.protection.get(c.id);
  const topo = topology.circuits.get(c.id);
  const reading = snapshot.circuits.get(c.id);
  const findings = report.findings.filter((f) => f.targetId === c.id);
  const up = (patch: Partial<Circuit>) => st.updateCircuit(c.id, patch);
  const [showAll, setShowAll] = useState(false);

  return (
    <div>
      <h2 className="panel-title">
        <ListTree size={16} /> C{c.number} — {c.name}
      </h2>
      <div className="subtitle">
        {topo?.connected ? `Ligado · fase(s) ${topo.phasesReached.filter(Boolean).join(', ')}` : 'Não conectado completamente'} · protegido por{' '}
        {prot ? prot.label : 'nenhum disjuntor'}
        {topo?.rcdIds.length ? ` · DR: ${topo.rcdIds.map((id) => project.devices.find((d) => d.id === id)?.label).join(', ')}` : ''}
      </div>

      <Section title="Identificação">
        <div className="stack">
          <div className="grid2">
            <Field label="Nome">
              <TextInput value={c.name} onChange={(v) => up({ name: v.slice(0, 60) })} />
            </Field>
            <Field label="Tipo">
              <Select value={c.kind} options={Object.entries(KIND_LABEL).map(([v, l]) => ({ value: v as Circuit['kind'], label: l }))} onChange={(v) => up({ kind: v })} />
            </Field>
          </div>
          <Field label="Ligação">
            <Select
              value={c.connection}
              options={(Object.keys(CONNECTION_LABEL) as CircuitConnection[]).map((k) => ({
                value: k,
                label: `${CONNECTION_LABEL[k]}${supplySupportsConnection(supply, k) ? '' : ' — indisponível'}`,
              }))}
              onChange={(v) => up({ connection: v })}
            />
          </Field>
          <Field label="Ambientes atendidos (afeta exigência de DR)">
            <div className="row wrap">
              {(Object.keys(LOCATION_LABEL) as Location[]).map((l) => (
                <span
                  key={l}
                  className={`chip ${c.locations.includes(l) ? 'on' : ''}`}
                  onClick={() => up({ locations: c.locations.includes(l) ? c.locations.filter((x) => x !== l) : [...c.locations, l] })}
                >
                  {LOCATION_LABEL[l]}
                </span>
              ))}
            </div>
          </Field>
        </div>
      </Section>

      <Section title={`Cargas (${c.loads.length})`} right={<button className="btn sm" onClick={() => st.addLoad(c.id)}><Plus size={13} /> Carga</button>}>
        <div className="stack">
          {c.loads.map((l) => (
            <div key={l.id} className="card">
              <div className="row">
                <div className="grow">
                  <TextInput value={l.name} onChange={(v) => st.updateLoad(c.id, l.id, { name: v.slice(0, 60) })} />
                </div>
                <button className="btn sm icon ghost" title="Remover carga" onClick={() => st.removeLoad(c.id, l.id)}>
                  <X size={13} />
                </button>
              </div>
              <div className="grid2" style={{ marginTop: 6 }}>
                <Field label="Potência (unid.)">
                  <NumberInput value={l.powerW} unit="W" min={0.1} max={100000} onChange={(v) => v !== null && st.updateLoad(c.id, l.id, { powerW: v })} />
                </Field>
                <Field label="Quantidade">
                  <NumberInput value={l.quantity} min={1} max={200} decimals={0} onChange={(v) => v !== null && st.updateLoad(c.id, l.id, { quantity: Math.round(v) })} />
                </Field>
                <Field label="Fator de potência">
                  <NumberInput value={l.powerFactor} min={0.1} max={1} onChange={(v) => v !== null && st.updateLoad(c.id, l.id, { powerFactor: v })} />
                </Field>
                <Field label="Rendimento η" hint="Para motores informe a potência útil e o rendimento; para cargas resistivas, η = 1">
                  <NumberInput value={l.efficiency} min={0.1} max={1} onChange={(v) => v !== null && st.updateLoad(c.id, l.id, { efficiency: v })} />
                </Field>
              </div>
            </div>
          ))}
          {!c.loads.length && <div className="warn-box">Sem cargas: a corrente de projeto não pode ser calculada.</div>}
        </div>
      </Section>

      <Section title="Condições de instalação">
        <div className="stack">
          <div className="grid2">
            <Field label="Comprimento">
              <NumberInput value={c.lengthM} nullable unit="m" min={0.1} max={2000} onChange={(v) => up({ lengthM: v })} />
            </Field>
            <Field label="Temperatura ambiente">
              <NumberInput value={c.ambientTempC} nullable unit="°C" min={-10} max={80} onChange={(v) => up({ ambientTempC: v })} />
            </Field>
            <Field label="Circuitos agrupados">
              <NumberInput value={c.groupedCircuits} nullable min={1} max={20} decimals={0} onChange={(v) => up({ groupedCircuits: v === null ? null : Math.round(v) })} />
            </Field>
            <Field label="Material">
              <Select value={c.material} options={[{ value: 'cobre', label: 'Cobre' }, { value: 'aluminio', label: 'Alumínio' }]} onChange={(v) => up({ material: v })} />
            </Field>
          </div>
          <Field label="Método de instalação">
            <select className="select" value={c.method ?? ''} onChange={(e) => up({ method: (e.target.value || null) as InstallationMethod | null })}>
              <option value="">— não informado —</option>
              {(['A1', 'A2', 'B1', 'C'] as InstallationMethod[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid2">
            <Field label="Isolação">
              <Select value={c.insulation} options={[{ value: 'PVC', label: 'PVC (70 °C)' }, { value: 'EPR', label: 'EPR (90 °C)' }, { value: 'XLPE', label: 'XLPE (90 °C)' }]} onChange={(v) => up({ insulation: v })} />
            </Field>
            <Field label="Limite de queda">
              <NumberInput value={c.voltageDropLimitPct} unit="%" min={0.5} max={10} onChange={(v) => v !== null && up({ voltageDropLimitPct: v })} />
            </Field>
          </div>
          <Field label="Origem do limite de queda">
            <Select
              value={c.voltageDropLimitSource}
              options={[
                { value: 'normativo', label: 'Normativo (circuito terminal: 4 %)' },
                { value: 'exercicio', label: 'Meta didática do exercício' },
              ]}
              onChange={(v) => up({ voltageDropLimitSource: v, voltageDropLimitPct: v === 'normativo' ? 4 : c.voltageDropLimitPct })}
            />
          </Field>
          {(c.method === null || c.ambientTempC === null || c.groupedCircuits === null) && (
            <button className="btn sm" onClick={() => up({ method: c.method ?? 'B1', ambientTempC: c.ambientTempC ?? 30, groupedCircuits: c.groupedCircuits ?? 1 })} title="Hipótese explícita: você confirma as condições">
              Adotar hipótese B1 · 30 °C · sem agrupamento
            </button>
          )}
        </div>
      </Section>

      <Section title="Dimensionamento">
        {sz ? (
          <div className="stack">
            <div className="row wrap">
              <Badge kind={sz.sizingStatus}>{sz.sizingStatus === 'ok' ? 'seção mínima encontrada' : sz.sizingStatus}</Badge>
              <span className="small">{sz.summary}</span>
            </div>
            <Kv
              items={[
                ['Potência ativa', sz.load ? `${formatNumberBR(sz.load.activeW, 0)} W` : '—'],
                ['Potência aparente', sz.load ? `${formatNumberBR(sz.load.apparentVA, 0)} VA` : '—'],
                ['Fator de potência', sz.load ? formatNumberBR(sz.load.powerFactor, 3) : '—'],
                ['Tensão', `${sz.voltageV} V`],
                ['Corrente de projeto Ib', sz.designCurrentA ? `${formatNumberBR(sz.designCurrentA)} A` : '—'],
                ['Fórmula', sz.formula ?? '—'],
                ['Proteção instalada', prot ? `${prot.label}: ${prot.curve ?? '?'}${prot.ratedCurrentA ?? '?'} · Icn ${prot.breakingCapacityKA ?? '?'} kA` : 'nenhuma (derivada das ligações)'],
                ['In sugerida', sz.recommendedInA ? `${sz.recommendedInA} A` : '—'],
              ]}
            />
            <div className="grid2">
              <Field label="Seção escolhida">
                <select className="select" value={c.sectionMm2 ?? ''} onChange={(e) => up({ sectionMm2: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">— não definida —</option>
                  {AVAILABLE_SECTIONS_MM2.map((s) => (
                    <option key={s} value={s}>
                      {formatNumberBR(s)} mm²
                    </option>
                  ))}
                </select>
              </Field>
              <Field label=" ">
                <button className="btn" disabled={sz.minSectionMm2 === null || sz.minSectionMm2 === c.sectionMm2} onClick={() => up({ sectionMm2: sz.minSectionMm2 })}>
                  Aplicar mínima
                </button>
              </Field>
            </div>
            {sz.chosen && (
              <div className="card">
                <div className="row" style={{ marginBottom: 6 }}>
                  <b className="grow">Verificação de {formatNumberBR(sz.chosen.sectionMm2)} mm²</b>
                  <Badge kind={sz.chosenStatus}>{sz.chosenStatus}</Badge>
                </div>
                <div className="stack">
                  {sz.chosen.criteria.map((cr) => (
                    <div key={cr.id} className="small">
                      <Badge kind={STATUS_KIND[cr.status]}>{cr.status}</Badge> <b>{cr.label}</b>
                      <div className="muted" style={{ marginTop: 2 }}>
                        {cr.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <table className="data">
              <thead>
                <tr>
                  <th>Seção</th>
                  <th>Iz</th>
                  <th>ΔU</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {sz.evaluations.slice(0, showAll ? undefined : 6).map((ev) => {
                  const fail = ev.criteria.find((x) => x.status === 'falha');
                  return (
                    <tr key={ev.sectionMm2} title={fail ? fail.detail : ''} className={ev.sectionMm2 === sz.minSectionMm2 ? 'sel' : ''}>
                      <td>{formatNumberBR(ev.sectionMm2)} mm²</td>
                      <td className="num">{ev.izA !== null ? formatNumberBR(ev.izA, 1) : '—'}</td>
                      <td className="num">{ev.dropPct !== null ? `${formatNumberBR(ev.dropPct)} %` : '—'}</td>
                      <td>
                        {ev.accepted === true ? <Badge kind="ok">atende</Badge> : ev.accepted === false ? <Badge kind="falha">{fail?.label}</Badge> : <Badge kind="inconclusivo">inconclusivo</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sz.evaluations.length > 6 && (
              <button className="btn sm ghost" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Mostrar menos' : 'Mostrar todas as seções'}
              </button>
            )}
            {sz.assumptions.length > 0 && (
              <details className="small muted">
                <summary>Hipóteses e dados considerados ({sz.assumptions.length})</summary>
                <ul>
                  {sz.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ) : (
          <div className="empty">Sem dados.</div>
        )}
      </Section>

      {findings.length > 0 && (
        <Section title={`Verificações do circuito (${findings.length})`}>
          <div className="stack">
            {findings.map((f, i) => (
              <div key={i} className="small">
                <Badge kind={f.severity}>{f.severity}</Badge> {f.message}
                {f.hint && <div className="muted">{f.hint}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {mode === 'simulacao' && (
        <Section title="Simulação e falhas (modo seguro)" icon={<TriangleAlert size={13} />}>
          <div className="stack">
            {reading && (
              <Kv
                items={[
                  ['Estado', reading.status],
                  ['Tensão na carga', `${formatNumberBR(reading.voltageV, 1)} V (nominal ${reading.nominalV} V)`],
                  ['Corrente', formatCurrent(reading.currentA)],
                  ['Potência', `${formatNumberBR(reading.powerW, 0)} W`],
                  ['Tensão massa–terra', `${formatNumberBR(reading.touchVoltageV, 1)} V`],
                  ...(reading.bodyCurrentA !== null ? [['Corrente no corpo (modelo)', formatCurrent(reading.bodyCurrentA)] as [string, string]] : []),
                  ...(reading.faultCurrentA !== null ? [['Corrente de falta', formatCurrent(reading.faultCurrentA)] as [string, string]] : []),
                ]}
              />
            )}
            <FaultButtons circuit={c} />
            <div className="small faint">Falhas são simuladas apenas virtualmente. Não reproduza em instalações reais.</div>
          </div>
        </Section>
      )}

      <div className="panel-body row">
        <button className="btn" onClick={() => st.duplicateCircuit(c.id)}>
          <Copy size={14} /> Duplicar
        </button>
        <button
          className="btn danger"
          onClick={() => {
            if (!window.confirm(`Remover o circuito C${c.number}? Os condutores ligados à saída serão removidos.`)) return;
            st.removeCircuit(c.id);
            useUiStore.getState().select(null);
          }}
        >
          <Trash2 size={14} /> Remover
        </button>
      </div>
    </div>
  );
}

function FaultButtons({ circuit: c }: { circuit: Circuit }) {
  const allFaults = useProjectStore((s) => s.project.simulation.faults);
  const faults = allFaults.filter((f) => f.circuitId === c.id);
  const st = useProjectStore.getState();
  const [leak, setLeak] = useState<number | null>(2000);
  const hasN = c.connection === 'F-N' || c.connection === '3F-N';
  const add = (f: Parameters<typeof st.addFault>[0], text: string) => {
    st.addFault(f);
    useUiStore.getState().addLog('warn', `Falha simulada em C${c.number}: ${text}`);
  };
  return (
    <div className="stack">
      <div className="row wrap">
        <button className="btn sm" onClick={() => add({ kind: 'overload', circuitId: c.id, factor: 2 }, 'sobrecarga ×2')}>
          Sobrecarga ×2
        </button>
        {hasN && (
          <button className="btn sm" onClick={() => add({ kind: 'short-circuit', circuitId: c.id, between: 'L-N' }, 'curto fase-neutro')}>
            Curto F-N
          </button>
        )}
        {!hasN && (
          <button className="btn sm" onClick={() => add({ kind: 'short-circuit', circuitId: c.id, between: 'L-L' }, 'curto fase-fase')}>
            Curto F-F
          </button>
        )}
        <button className="btn sm" onClick={() => add({ kind: 'short-circuit', circuitId: c.id, between: 'L-PE' }, 'falta fase-massa franca')}>
          Falta F-massa
        </button>
        <button className="btn sm" onClick={() => add({ kind: 'pe-open', circuitId: c.id }, 'PE interrompido')}>
          PE interrompido
        </button>
        {hasN && (
          <button className="btn sm" onClick={() => add({ kind: 'neutral-open', circuitId: c.id }, 'neutro interrompido')}>
            Neutro interrompido
          </button>
        )}
        <button className="btn sm" onClick={() => add({ kind: 'touch', circuitId: c.id, bodyResistanceOhm: 1000 }, 'pessoa toca a massa (1 kΩ, ilustrativo)')}>
          Toque na massa
        </button>
      </div>
      <div className="row">
        <div className="grow">
          <NumberInput value={leak} unit="Ω" min={10} max={1e7} onChange={setLeak} />
        </div>
        <button className="btn sm" disabled={!leak} onClick={() => leak && add({ kind: 'leakage', circuitId: c.id, resistanceOhm: leak }, `fuga por isolação de ${leak} Ω`)}>
          Fuga à massa
        </button>
      </div>
      {faults.length > 0 && (
        <div className="stack">
          {faults.map((f) => (
            <div key={f.id} className="row small">
              <Badge kind="alerta">{f.kind}</Badge>
              <span className="grow muted">
                {f.kind === 'leakage' ? `${f.resistanceOhm} Ω` : f.kind === 'overload' ? `×${f.factor}` : f.kind === 'short-circuit' ? f.between : f.kind === 'touch' ? `${f.bodyResistanceOhm} Ω` : ''}
              </span>
              <button className="btn sm icon ghost" onClick={() => st.removeFault(f.id)} title="Remover falha">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
