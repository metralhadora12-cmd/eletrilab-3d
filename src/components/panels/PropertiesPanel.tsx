import { useMemo } from 'react';
import { Cable, CircuitBoard, Power, RotateCcw, Trash2, Zap } from 'lucide-react';
import { effectiveElectrical, getCatalogItem } from '../../catalog';
import type { CatalogItem, Configurable } from '../../catalog/schema';
import { AVAILABLE_SECTIONS_MM2 } from '../../catalog/conductors';
import { COLOR_ORDER, FUNCTION_LABEL, WIRE_COLORS } from '../../catalog/colors';
import { useProjectStore } from '../../app/projectStore';
import { useUiStore } from '../../app/uiStore';
import { useSimStore } from '../../app/simStore';
import { useAnalysis } from '../../app/analysis';
import { computeWireLengths } from '../../model/geometry';
import { terminalDisplayName } from '../../model/terminals';
import { terminalKey, type DeviceConfig, type DeviceInstance, type Wire } from '../../model/schema';
import { THERMAL_MODEL } from '../../electrical/core/constants';
import { formatCurrent, formatNumberBR } from '../../electrical/core/units';
import { Badge, Field, Kv, NumberInput, Section, Select, TextInput, fmt } from '../ui/primitives';
import { CircuitEditor } from './CircuitEditor';
import { DOCUMENTS } from '../../normative/sources';

export function PropertiesPanel() {
  const selection = useUiStore((s) => s.selection);
  const project = useProjectStore((s) => s.project);
  let body: JSX.Element;
  if (selection?.kind === 'device') {
    const d = project.devices.find((x) => x.id === selection.id);
    body = d ? <DeviceProps device={d} /> : <ProjectProps />;
  } else if (selection?.kind === 'wire') {
    const w = project.wires.find((x) => x.id === selection.id);
    body = w ? <WireProps wire={w} /> : <ProjectProps />;
  } else if (selection?.kind === 'circuit') {
    const c = project.circuits.find((x) => x.id === selection.id);
    body = c ? <CircuitEditor circuit={c} /> : <ProjectProps />;
  } else if (selection?.kind === 'comb') {
    const c = project.combs.find((x) => x.id === selection.id);
    body = c ? <CombProps id={c.id} /> : <ProjectProps />;
  } else {
    body = <ProjectProps />;
  }
  return (
    <aside className="right" aria-label="Propriedades">
      <div className="scroll">{body}</div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
function ProjectProps() {
  const project = useProjectStore((s) => s.project);
  const st = useProjectStore.getState();
  const s = project.supply;
  const e = project.enclosure;
  const toast = useUiStore((x) => x.toast);
  return (
    <div>
      <h2 className="panel-title">
        <CircuitBoard size={16} /> Projeto e alimentação
      </h2>
      <div className="subtitle">Selecione um componente, condutor ou circuito para ver suas propriedades.</div>
      <Section title="Projeto">
        <div className="stack">
          <Field label="Nome">
            <TextInput value={project.name} onChange={(v) => st.rename(v)} />
          </Field>
          <Field label="Descrição">
            <textarea className="input" rows={3} defaultValue={project.description} onBlur={(ev) => st.rename(project.name, ev.target.value)} />
          </Field>
          <Field label="Perfil de validação">
            <Select
              value={project.validationProfile}
              options={[
                { value: 'aprendizado', label: 'Aprendizado — permite experimentar, explica problemas' },
                { value: 'tecnico', label: 'Validação técnica — rigorosa, sinaliza dados ausentes' },
                { value: 'desafio', label: 'Desafio — critérios da atividade' },
              ]}
              onChange={(v) => st.setValidationProfile(v)}
            />
          </Field>
        </div>
      </Section>
      <Section title="Alimentação do exercício">
        <div className="stack">
          <div className="grid2">
            <Field label="Tipo">
              <Select
                value={s.type}
                options={[
                  { value: 'monofasico', label: 'Monofásico (F+N)' },
                  { value: 'bifasico', label: 'Bifásico (2F+N)' },
                  { value: 'trifasico', label: 'Trifásico (3F+N)' },
                ]}
                onChange={(v) => {
                  st.updateSupply({ type: v });
                  toast('info', 'Condutores ligados a bornes inexistentes na nova alimentação foram removidos.');
                }}
              />
            </Field>
            <Field label="Tensão U0/U">
              <Select value={s.systemVoltage} options={[{ value: '127/220', label: '127/220 V' }, { value: '220/380', label: '220/380 V' }]} onChange={(v) => st.updateSupply({ systemVoltage: v })} />
            </Field>
            <Field label="Esquema de aterramento">
              <Select value={s.earthing} options={[{ value: 'TN-S', label: 'TN-S' }, { value: 'TN-C-S', label: 'TN-C-S' }, { value: 'TT', label: 'TT' }]} onChange={(v) => st.updateSupply({ earthing: v })} />
            </Field>
            <Field label="Frequência">
              <Select value={s.frequencyHz} options={[{ value: 60, label: '60 Hz' }, { value: 50, label: '50 Hz' }]} onChange={(v) => st.updateSupply({ frequencyHz: v as 60 | 50 })} />
            </Field>
            <Field label="Icc presumida no quadro" hint="Corrente de curto-circuito presumida na origem; informada pela concessionária ou calculada">
              <NumberInput value={s.prospectiveShortCircuitKA} nullable unit="kA" min={0.1} max={100} onChange={(v) => st.updateSupply({ prospectiveShortCircuitKA: v })} />
            </Field>
            <Field label="Queda a montante" hint="Queda de tensão entre o ponto de entrega e o quadro">
              <NumberInput value={s.upstreamVoltageDropPct} nullable unit="%" min={0} max={10} onChange={(v) => st.updateSupply({ upstreamVoltageDropPct: v })} />
            </Field>
            <Field label="RA (eletrodo)" hint="Resistência de aterramento das massas — essencial em TT">
              <NumberInput value={s.earthElectrodeResistanceOhm} nullable unit="Ω" min={0.1} max={10000} onChange={(v) => st.updateSupply({ earthElectrodeResistanceOhm: v })} />
            </Field>
            <Field label="RB (fonte)" hint="Resistência de aterramento da fonte (ilustrativa)">
              <NumberInput value={s.sourceEarthResistanceOhm} nullable unit="Ω" min={0.1} max={1000} onChange={(v) => st.updateSupply({ sourceEarthResistanceOhm: v })} />
            </Field>
          </div>
          <div className="small muted">Campos vazios = dado não informado. Cálculos que dependem deles ficam inconclusivos; a simulação usa valores ilustrativos sinalizados.</div>
        </div>
      </Section>
      <Section title="Quadro de distribuição">
        <div className="grid2">
          <Field label="Montagem">
            <Select value={e.mounting} options={[{ value: 'sobrepor', label: 'Sobrepor' }, { value: 'embutir', label: 'Embutir' }]} onChange={(v) => st.updateEnclosure({ mounting: v })} />
          </Field>
          <Field label="Identificação">
            <TextInput value={e.label} onChange={(v) => st.updateEnclosure({ label: v.slice(0, 60) })} />
          </Field>
          <Field label="Trilhos DIN">
            <Select
              value={e.rows}
              options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}` }))}
              onChange={(v) => {
                const r = st.updateEnclosure({ rows: v });
                if (!r.ok) toast('warn', r.message ?? '');
              }}
            />
          </Field>
          <Field label="Módulos por trilho">
            <Select
              value={e.modulesPerRow}
              options={[12, 18, 24, 36].map((n) => ({ value: n, label: `${n}` }))}
              onChange={(v) => {
                const r = st.updateEnclosure({ modulesPerRow: v });
                if (!r.ok) toast('warn', r.message ?? '');
              }}
            />
          </Field>
        </div>
      </Section>
      <Section title="Avisos" defaultOpen>
        <div className="warn-box">
          Ferramenta educacional. Não substitui projeto elétrico, profissional legalmente habilitado, inspeções ou ensaios de campo. Regras implementadas a partir de fontes secundárias da {DOCUMENTS.NBR5410.title.split(' — ')[0]} ({DOCUMENTS.NBR5410.edition}); a norma está em revisão.
        </div>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
const CONFIG_LABEL: Record<keyof Configurable, { label: string; unit: string }> = {
  ratedCurrentA: { label: 'Corrente nominal (In)', unit: 'A' },
  curve: { label: 'Curva de disparo', unit: '' },
  breakingCapacityKA: { label: 'Capacidade de interrupção (Icn)', unit: 'kA' },
  residualCurrentMA: { label: 'Sensibilidade (IΔn)', unit: 'mA' },
  rcdType: { label: 'Tipo do DR', unit: '' },
  spdClass: { label: 'Classe (tipo) do DPS', unit: '' },
  ucV: { label: 'Uc (máx. operação contínua)', unit: 'V' },
  upKV: { label: 'Up (nível de proteção)', unit: 'kV' },
  inKA: { label: 'In (descarga nominal)', unit: 'kA' },
  imaxKA: { label: 'Imax (descarga máxima)', unit: 'kA' },
};

const ELECTRICAL_LABEL: Record<string, string> = {
  standard: 'Norma de produto',
  poles: 'Polos',
  ratedCurrentA: 'In (A)',
  curve: 'Curva',
  ratedVoltageV: 'Tensão nominal (V)',
  breakingCapacityKA: 'Icn (kA)',
  frequencyHz: 'Frequência (Hz)',
  residualCurrentMA: 'IΔn (mA)',
  rcdType: 'Tipo',
  spdClass: 'Tipo (classe)',
  ucV: 'Uc (V)',
  upKV: 'Up (kV)',
  inKA: 'In (kA)',
  imaxKA: 'Imax (kA)',
  iimpKA: 'Iimp (kA)',
  endOfLifeIndicator: 'Indicador de fim de vida',
  function: 'Função',
  blockKind: 'Tipo',
  phases: 'Fases',
};

const EXPLAIN: Record<string, string[]> = {
  disjuntor: [
    'In é a corrente que o disjuntor conduz continuamente sem disparar. Ela deve atender Ib ≤ In ≤ Iz — sozinha não garante a proteção do circuito.',
    'Sobrecarga (corrente moderadamente acima de In) é eliminada pelo disparador térmico, com tempo inverso. Curto-circuito é eliminado pelo disparador magnético, instantaneamente, quando a corrente supera o limite da curva (B: 3–5·In; C: 5–10·In; D: 10–20·In).',
    'Icn é a maior corrente de curto que o disjuntor interrompe com segurança; deve ser ≥ Icc presumida no ponto de instalação.',
  ],
  dr: [
    'In do DR é a corrente que ele suporta continuamente; IΔn é a diferença entre correntes (fuga) que provoca a atuação. São grandezas diferentes.',
    'O interruptor DR não protege contra sobrecargas: precisa de disjuntor coordenado.',
    'A atuação simulada usa limiar determinístico em IΔn; a norma de produto admite atuação entre 0,5 e 1·IΔn. A simulação não substitui ensaios instrumentais reais.',
  ],
  dps: [
    'Uc: maior tensão eficaz contínua aplicável. Up: tensão residual que o DPS deixa passar durante o surto. In/Imax/Iimp: correntes de descarga suportadas.',
    'A seleção e coordenação dependem do esquema de aterramento, das características da alimentação, da exposição a surtos e das instruções do fabricante.',
    'O DPS não substitui disjuntor, DR nem aterramento.',
  ],
};

function DeviceProps({ device }: { device: DeviceInstance }) {
  const item = getCatalogItem(device.catalogId)!;
  const st = useProjectStore.getState();
  const mode = useUiStore((s) => s.mode);
  const { snapshot, topology, project, report } = useAnalysis();
  const thermal = useSimStore((s) => s.thermal[device.id] ?? 0);
  const e = effectiveElectrical(device, item) as Record<string, unknown>;
  const reading = snapshot.devices.get(device.id);
  const topo = topology.devices.get(device.id);
  const findings = report.findings.filter((f) => f.targetId === device.id);
  const label = (id: string) => project.devices.find((d) => d.id === id)?.label ?? id;
  const hasLever = item.category === 'disjuntor' || item.category === 'dr';

  return (
    <div>
      <h2 className="panel-title">
        <Zap size={16} /> {device.label}
      </h2>
      <div className="subtitle">{item.name}</div>
      <Section title="Identificação e origem dos dados">
        <div className="stack">
          <Field label="Identificação no quadro">
            <TextInput value={device.label} onChange={(v) => st.updateDevice(device.id, { label: v.slice(0, 24) || device.label })} />
          </Field>
          <Kv
            items={[
              ['Origem', item.origin === 'generico-didatico' ? 'Genérico didático' : 'Modelo comercial'],
              ['Fabricante / modelo', item.manufacturer ? `${item.manufacturer} ${item.model}` : 'não se aplica'],
              ['Verificação', <Badge key="b" kind={item.source.status === 'pendente' ? 'inconclusivo' : 'neutral'}>{item.source.status}</Badge>],
              ['Revisão', item.source.reviewedAt],
              ['Posição', `trilho ${device.row + 1}, módulo ${device.module + 1} (${item.dimensions.widthModules} mód.)`],
            ]}
          />
          <div className="small muted">{item.source.reference}</div>
          {item.source.notes && <div className="small faint">{item.source.notes}</div>}
        </div>
      </Section>
      {Object.keys(item.configurable).length > 0 && (
        <Section title="Parâmetros configuráveis">
          <div className="grid2">
            {(Object.entries(item.configurable) as Array<[keyof Configurable, Array<string | number>]>).map(([key, opts]) => (
              <Field key={key} label={CONFIG_LABEL[key].label}>
                <Select
                  value={(device.config as Record<string, string | number | null>)[key] ?? null}
                  options={opts.map((o) => ({ value: o, label: `${typeof o === 'number' ? formatNumberBR(o) : o}${CONFIG_LABEL[key].unit ? ` ${CONFIG_LABEL[key].unit}` : ''}` }))}
                  onChange={(v) => st.updateDeviceConfig(device.id, { [key]: v } as DeviceConfig)}
                />
              </Field>
            ))}
          </div>
        </Section>
      )}
      <Section title="Dados nominais">
        <Kv
          items={Object.entries(e)
            .filter(([k]) => k !== 'category')
            .map(([k, v]) => [ELECTRICAL_LABEL[k] ?? k, v === null ? <span key={k} className="badge inconclusivo">desconhecido</span> : typeof v === 'boolean' ? (v ? 'sim' : 'não') : String(v)])}
        />
        {Object.values(e).some((v) => v === null) && (
          <div className="warn-box" style={{ marginTop: 8 }}>
            Dados desconhecidos não são presumidos: as verificações que dependem deles serão inconclusivas.
          </div>
        )}
      </Section>
      {(hasLever || item.category === 'dps') && (
        <Section title="Estado operacional">
          <div className="stack">
            {hasLever && (
              <div className="row wrap">
                <Badge kind={device.state === 'on' ? 'ok' : device.state === 'tripped' ? 'erro' : 'neutral'}>
                  {device.state === 'on' ? 'Ligado' : device.state === 'tripped' ? 'Desarmado' : 'Desligado'}
                </Badge>
                <button className="btn sm" onClick={() => st.setDeviceState(device.id, 'on')} disabled={device.state === 'on'}>
                  <Power size={13} /> Ligar
                </button>
                <button className="btn sm" onClick={() => st.setDeviceState(device.id, 'off')} disabled={device.state === 'off'}>
                  Desligar
                </button>
                {device.state === 'tripped' && (
                  <button className="btn sm" onClick={() => st.setDeviceState(device.id, 'off')}>
                    <RotateCcw size={13} /> Rearmar
                  </button>
                )}
              </div>
            )}
            {item.category === 'dps' && (
              <div className="row">
                <Badge kind={device.spd?.endOfLife ? 'erro' : 'ok'}>{device.spd?.endOfLife ? 'Fim de vida' : 'Operante'}</Badge>
                <span className="small muted">surtos registrados: {device.spd?.surges ?? 0}</span>
                {device.spd?.endOfLife && (
                  <button
                    className="btn sm"
                    onClick={() =>
                      st.commit('Substituir DPS', (d) => {
                        const x = d.devices.find((y) => y.id === device.id);
                        if (x?.spd) x.spd = { endOfLife: false, surges: 0 };
                      })
                    }
                  >
                    Substituir
                  </button>
                )}
              </div>
            )}
            {reading && project.simulation.energized && (
              <Kv
                items={[
                  ...reading.poleCurrentsA.map((i, k): [string, string] => [`Polo ${k + 1}`, formatCurrent(i)]),
                  ...(reading.differentialA !== null ? [['|ΣI| (diferencial)', formatCurrent(reading.differentialA)] as [string, string]] : []),
                  ...(item.category === 'disjuntor' ? [['Aquecimento (modelo)', `${formatNumberBR((100 * thermal) / THERMAL_MODEL.thresholdMultiple ** 2, 0)} %`] as [string, string]] : []),
                ]}
              />
            )}
            {mode !== 'simulacao' && <div className="small muted">Manobras e leituras ao vivo no modo Simulação (clique na alavanca no 3D).</div>}
          </div>
        </Section>
      )}
      {topo && (
        <Section title="Ligações">
          <Kv
            items={[
              ['Lado de linha', topo.lineSide === 'top' ? 'superior' : topo.lineSide === 'bottom' ? 'inferior (alimentação reversa)' : item.category === 'dps' ? (topo.connectedSources.join('/') || 'sem ligação') : 'não alimentado'],
              ['A montante', topo.upstream.map(label).join(' → ') || 'entrada'],
              ['Circuitos a jusante', topo.downstreamCircuits.map((id) => `C${project.circuits.find((c) => c.id === id)?.number}`).join(', ') || '—'],
            ]}
          />
          <TerminalConnections device={device} item={item} />
        </Section>
      )}
      {findings.length > 0 && (
        <Section title={`Verificações (${findings.length})`}>
          <div className="stack">
            {findings.map((f, i) => (
              <div key={i} className="small">
                <Badge kind={f.severity}>{f.severity}</Badge> {f.message}
              </div>
            ))}
          </div>
        </Section>
      )}
      {EXPLAIN[item.category] && (
        <Section title="Entenda o dispositivo" defaultOpen={false}>
          <div className="stack small">
            {EXPLAIN[item.category].map((t, i) => (
              <p key={i} style={{ margin: 0, lineHeight: 1.5 }}>
                {t}
              </p>
            ))}
          </div>
        </Section>
      )}
      <div className="panel-body">
        <button
          className="btn danger"
          disabled={mode !== 'montagem'}
          onClick={() => {
            st.removeDevice(device.id);
            useUiStore.getState().select(null);
          }}
        >
          <Trash2 size={14} /> Remover dispositivo (Del)
        </button>
      </div>
    </div>
  );
}

function TerminalConnections({ device, item }: { device: DeviceInstance; item: CatalogItem }) {
  const project = useProjectStore((s) => s.project);
  const rows = item.terminals.map((t) => {
    const key = terminalKey({ owner: device.id, terminal: t.id });
    const ws = project.wires.filter((w) => terminalKey(w.from) === key || terminalKey(w.to) === key);
    return { t, ws, key };
  });
  return (
    <table className="data" style={{ marginTop: 8 }}>
      <thead>
        <tr>
          <th>Borne</th>
          <th>Aceita</th>
          <th>Ligado a</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ t, ws, key }) => (
          <tr key={t.id}>
            <td>{t.label}</td>
            <td>{t.accepts.join('/')}</td>
            <td style={{ whiteSpace: 'normal' }}>
              {ws.length
                ? ws.map((w) => (
                    <div key={w.id}>
                      <span className="swatch" style={{ display: 'inline-block', width: 9, height: 9, background: WIRE_COLORS[w.color].hex, verticalAlign: 0 }} />{' '}
                      {terminalDisplayName(project, terminalKey(w.from) === key ? w.to : w.from)}
                    </div>
                  ))
                : <span className="faint">livre</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
function WireProps({ wire }: { wire: Wire }) {
  const st = useProjectStore.getState();
  const { project, topology, snapshot, report } = useAnalysis();
  const length = useMemo(() => computeWireLengths(project).get(wire.id) ?? 0, [project, wire.id]);
  const fn = topology.wireFunction.get(wire.id);
  const findings = report.findings.filter((f) => f.targetId === wire.id);
  const info = WIRE_COLORS[wire.color];
  return (
    <div>
      <h2 className="panel-title">
        <Cable size={16} /> Condutor {formatNumberBR(wire.sectionMm2)} mm²
      </h2>
      <div className="subtitle">
        {terminalDisplayName(project, wire.from)} → {terminalDisplayName(project, wire.to)}
      </div>
      <Section title="Propriedades">
        <div className="stack">
          <div className="grid2">
            <Field label="Cor de identificação">
              <Select value={wire.color} options={COLOR_ORDER.map((c) => ({ value: c, label: WIRE_COLORS[c].name }))} onChange={(v) => st.updateWire(wire.id, { color: v })} />
            </Field>
            <Field label="Seção nominal">
              <Select value={wire.sectionMm2} options={AVAILABLE_SECTIONS_MM2.map((s) => ({ value: s, label: `${formatNumberBR(s)} mm²` }))} onChange={(v) => st.updateWire(wire.id, { sectionMm2: v })} />
            </Field>
            <Field label="Material">
              <Select value={wire.material} options={[{ value: 'cobre', label: 'Cobre' }]} onChange={(v) => st.updateWire(wire.id, { material: v })} />
            </Field>
            <Field label="Isolação">
              <Select value={wire.insulation} options={[{ value: 'PVC', label: 'PVC (70 °C)' }, { value: 'EPR', label: 'EPR (90 °C)' }, { value: 'XLPE', label: 'XLPE (90 °C)' }]} onChange={(v) => st.updateWire(wire.id, { insulation: v })} />
            </Field>
          </div>
          <Field label={`Folga / comprimento: ${formatNumberBR(length * 1000, 0)} mm`}>
            <input type="range" min={0} max={300} step={5} value={wire.slackMm} onChange={(ev) => st.updateWire(wire.id, { slackMm: Number(ev.target.value) })} aria-label="Folga do condutor" />
          </Field>
          <Field label="Rótulo">
            <TextInput value={wire.label ?? ''} onChange={(v) => st.updateWire(wire.id, { label: v.slice(0, 40) || undefined })} placeholder="ex.: C3-F" />
          </Field>
          <label className="check">
            <input type="checkbox" checked={wire.broken} onChange={(ev) => st.updateWire(wire.id, { broken: ev.target.checked })} /> Simular condutor interrompido
          </label>
        </div>
      </Section>
      <Section title="Identificação e função">
        <Kv
          items={[
            ['Cor (gráfica)', info.name],
            ['Norma permite', info.normativeFunctions.map((f) => FUNCTION_LABEL[f]).join(' / ')],
            ['Convenção didática', info.didactic],
            ['Função real (ligações)', fn?.conflict ? 'conflito (curto)' : fn?.fn ? `${FUNCTION_LABEL[fn.fn]}${fn.phase ? ` ${fn.phase}` : ''}` : 'sem origem'],
            ['Corrente (simulação)', project.simulation.energized ? formatCurrent(snapshot.wireCurrentsA.get(wire.id) ?? 0) : '—'],
            ['Comprimento', `${formatNumberBR(length, 3)} m`],
          ]}
        />
      </Section>
      {findings.length > 0 && (
        <Section title="Verificações">
          <div className="stack">
            {findings.map((f, i) => (
              <div key={i} className="small">
                <Badge kind={f.severity}>{f.severity}</Badge> {f.message}
              </div>
            ))}
          </div>
        </Section>
      )}
      <div className="panel-body">
        <button
          className="btn danger"
          onClick={() => {
            st.removeWire(wire.id);
            useUiStore.getState().select(null);
          }}
        >
          <Trash2 size={14} /> Remover condutor (Del)
        </button>
      </div>
    </div>
  );
}

function CombProps({ id }: { id: string }) {
  const comb = useProjectStore((s) => s.project.combs.find((c) => c.id === id))!;
  const rows = useProjectStore((s) => s.project.enclosure.rows);
  const st = useProjectStore.getState();
  const toast = useUiStore((s) => s.toast);
  const apply = (patch: Partial<typeof comb>) => {
    const r = st.updateComb(id, patch);
    if (!r.ok) toast('warn', r.message ?? 'Inválido');
  };
  return (
    <div>
      <h2 className="panel-title">Barramento pente ({comb.phases}F)</h2>
      <div className="subtitle">Interliga os bornes superiores dos disjuntores cobertos. Dentes alternam as fases a cada módulo.</div>
      <Section title="Posição">
        <div className="grid2">
          <Field label="Trilho">
            <Select value={comb.row} options={Array.from({ length: rows }, (_, i) => ({ value: i, label: `${i + 1}` }))} onChange={(v) => apply({ row: v })} />
          </Field>
          <Field label="Módulo inicial">
            <NumberInput value={comb.startModule + 1} min={1} max={36} decimals={0} onChange={(v) => v !== null && apply({ startModule: Math.round(v) - 1 })} />
          </Field>
          <Field label="Comprimento (módulos)">
            <NumberInput value={comb.lengthModules} min={2} max={36} decimals={0} onChange={(v) => v !== null && apply({ lengthModules: Math.round(v) })} />
          </Field>
        </div>
      </Section>
      <div className="panel-body">
        <button
          className="btn danger"
          onClick={() => {
            st.removeComb(id);
            useUiStore.getState().select(null);
          }}
        >
          <Trash2 size={14} /> Remover pente
        </button>
      </div>
    </div>
  );
}

export { fmt };
