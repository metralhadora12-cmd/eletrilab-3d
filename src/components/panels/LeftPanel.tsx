import { useMemo, useState } from 'react';
import { Boxes, Cable, GraduationCap, ListTree, Plus, Search } from 'lucide-react';
import { CATEGORY_LABEL, searchCatalog } from '../../catalog';
import type { CatalogItem, Category } from '../../catalog/schema';
import { AVAILABLE_SECTIONS_MM2 } from '../../catalog/conductors';
import { COLOR_ORDER, FUNCTION_LABEL, WIRE_COLORS } from '../../catalog/colors';
import { useUiStore } from '../../app/uiStore';
import { useProjectStore } from '../../app/projectStore';
import { useAnalysis } from '../../app/analysis';
import type { CircuitKind } from '../../model/schema';
import { formatNumberBR } from '../../electrical/core/units';
import { Badge, Section, Select } from '../ui/primitives';
import { AcademyPanel } from './AcademyPanel';

export function LeftPanel() {
  const tab = useUiStore((s) => s.leftTab);
  const set = useUiStore((s) => s.set);
  return (
    <aside className="left" aria-label="Painel esquerdo">
      <div className="tabs">
        <button className={tab === 'biblioteca' ? 'on' : ''} onClick={() => set({ leftTab: 'biblioteca' })}>
          <Boxes size={14} /> Biblioteca
        </button>
        <button className={tab === 'circuitos' ? 'on' : ''} onClick={() => set({ leftTab: 'circuitos' })}>
          <ListTree size={14} /> Circuitos
        </button>
        <button className={tab === 'academia' ? 'on' : ''} onClick={() => set({ leftTab: 'academia' })}>
          <GraduationCap size={14} /> Academia
        </button>
      </div>
      <div className="scroll">
        {tab === 'biblioteca' && <Library />}
        {tab === 'circuitos' && <CircuitList />}
        {tab === 'academia' && <AcademyPanel />}
      </div>
    </aside>
  );
}

const CATS: Array<Category | 'todos'> = ['todos', 'disjuntor', 'dr', 'dps', 'barramento', 'borne', 'pente'];

function Thumb({ item }: { item: CatalogItem }) {
  const text = item.category === 'disjuntor' ? 'Q' : item.category === 'dr' ? 'DR' : item.category === 'dps' ? 'DPS' : item.category === 'pente' ? 'P' : item.category === 'barramento' ? (item.electrical.category === 'barramento' ? item.electrical.function : '') : 'X';
  return (
    <div className="lib-thumb" style={{ background: item.appearance.bodyColor, width: 14 + item.dimensions.widthModules * 8, color: ['#2f6db5', '#2e8b3e', '#3b82c4', '#3c9a4a', '#80868b', '#9aa0a6', '#c4532a'].includes(item.appearance.bodyColor) ? '#fff' : '#222' }}>
      {text}
    </div>
  );
}

function Library() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | 'todos'>('todos');
  const items = useMemo(() => searchCatalog(q, cat), [q, cat]);
  const placing = useUiStore((s) => s.placing);
  const mode = useUiStore((s) => s.mode);
  const set = useUiStore((s) => s.set);
  const editable = mode === 'montagem';

  const choose = (id: string) => {
    if (!editable) return;
    if (placing === id) set({ placing: null, tool: 'select', ghost: null });
    else set({ placing: id, tool: 'place', wireStart: null, coverOn: false, doorOpen: true });
  };

  return (
    <div>
      <div className="panel-body stack">
        <div className="unit-input">
          <input className="input" placeholder="Buscar componente (ex.: DR 30mA, curva C)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar componente" />
          <span className="unit">
            <Search size={13} />
          </span>
        </div>
        <div className="row wrap">
          {CATS.map((c) => (
            <span key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
              {c === 'todos' ? 'Todos' : CATEGORY_LABEL[c]}
            </span>
          ))}
        </div>
        {!editable && <div className="info-box">Inserção de componentes disponível no modo Montagem.</div>}
        <div className="stack">
          {items.map((item) => (
            <div
              key={item.id}
              className={`lib-item ${placing === item.id ? 'placing' : ''}`}
              draggable={editable}
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-eletrilab', item.id);
                e.dataTransfer.effectAllowed = 'copy';
                (window as unknown as { __eletrilabDrag?: string }).__eletrilabDrag = item.id;
                set({ coverOn: false, doorOpen: true });
              }}
              onDragEnd={() => {
                (window as unknown as { __eletrilabDrag?: string }).__eletrilabDrag = undefined;
                set({ ghost: null });
              }}
              onClick={() => choose(item.id)}
              title={item.description}
              style={{ opacity: editable ? 1 : 0.6 }}
            >
              <Thumb item={item} />
              <div className="grow">
                <div className="lib-name">{item.name}</div>
                <div className="lib-meta">
                  {item.dimensions.widthModules} módulo(s) · {item.origin === 'generico-didatico' ? 'genérico didático' : `${item.manufacturer} ${item.model}`}
                </div>
                <div className="row" style={{ marginTop: 4, gap: 4 }}>
                  {item.source.status === 'pendente' ? <Badge kind="inconclusivo">dados incompletos</Badge> : <Badge kind="neutral">{item.source.status}</Badge>}
                </div>
              </div>
            </div>
          ))}
          {!items.length && <div className="empty">Nenhum componente encontrado.</div>}
        </div>
      </div>
      <WirePalette />
    </div>
  );
}

function WirePalette() {
  const tool = useUiStore((s) => s.tool);
  const draft = useUiStore((s) => s.wireDraft);
  const mode = useUiStore((s) => s.mode);
  const set = useUiStore((s) => s.set);
  const profile = useProjectStore((s) => s.project.validationProfile);
  const info = WIRE_COLORS[draft.color];
  const toggle = () =>
    tool === 'wire'
      ? set({ tool: 'select', wireStart: null })
      : set({ tool: 'wire', placing: null, ghost: null, coverOn: false, doorOpen: true, instrument: null, probes: [] });
  return (
    <Section title="Condutores (ferramenta Fio)" icon={<Cable size={13} />}>
      <div className="stack">
        <button className={`btn ${tool === 'wire' ? 'active' : ''}`} disabled={mode !== 'montagem'} onClick={toggle}>
          <Cable size={14} /> {tool === 'wire' ? 'Ferramenta Fio ativa (Esc encerra)' : 'Ativar ferramenta Fio (W)'}
        </button>
        <div className="row wrap" role="radiogroup" aria-label="Cor do condutor">
          {COLOR_ORDER.map((c) => {
            const ci = WIRE_COLORS[c];
            return (
              <button
                key={c}
                className={`swatch ${draft.color === c ? 'on' : ''}`}
                title={`${ci.name} — ${ci.didactic}`}
                aria-label={ci.name}
                style={{ background: ci.stripeHex ? `repeating-linear-gradient(45deg, ${ci.hex} 0 5px, ${ci.stripeHex} 5px 10px)` : ci.hex }}
                onClick={() => set({ wireDraft: { ...draft, color: c } })}
              />
            );
          })}
        </div>
        <div className="small">
          <b>{info.name}</b> · norma: {info.normativeFunctions.map((f) => FUNCTION_LABEL[f]).join(' / ')} · <span className="muted">{info.didactic}</span>
        </div>
        <div className="grid2">
          <div className="field">
            <span className="label">Seção</span>
            <Select
              value={draft.sectionMm2}
              options={AVAILABLE_SECTIONS_MM2.map((s) => ({ value: s, label: `${formatNumberBR(s)} mm²` }))}
              onChange={(v) => set({ wireDraft: { ...draft, sectionMm2: v } })}
            />
          </div>
          <div className="field">
            <span className="label">Validação</span>
            <div className="small" style={{ paddingTop: 6 }}>
              {profile === 'aprendizado' ? 'livre (com avisos)' : 'rigorosa (bloqueia)'}
            </div>
          </div>
        </div>
        <div className="small muted">Clique no borne de origem e depois no de destino (ou arraste entre eles). Bornes verdes são compatíveis.</div>
      </div>
    </Section>
  );
}

const KIND_LABEL: Record<CircuitKind, string> = {
  iluminacao: 'Iluminação',
  tug: 'Tomadas de uso geral',
  tue: 'Tomada de uso específico',
  chuveiro: 'Chuveiro elétrico',
  'ar-condicionado': 'Ar-condicionado',
  forno: 'Forno elétrico',
  'maquina-lavar': 'Máquina de lavar',
  outro: 'Outro equipamento',
};
export { KIND_LABEL };

function CircuitList() {
  const project = useProjectStore((s) => s.project);
  const addCircuit = useProjectStore((s) => s.addCircuit);
  const select = useUiStore((s) => s.select);
  const selection = useUiStore((s) => s.selection);
  const [kind, setKind] = useState<CircuitKind>('tug');
  const { report, topology } = useAnalysis();
  return (
    <div className="panel-body stack">
      <div className="row">
        <div className="grow">
          <Select value={kind} options={Object.entries(KIND_LABEL).map(([v, l]) => ({ value: v as CircuitKind, label: l }))} onChange={setKind} />
        </div>
        <button
          className="btn primary"
          onClick={() => {
            const id = addCircuit(kind);
            select({ kind: 'circuit', id });
            useUiStore.getState().set({ rightOpen: true });
          }}
        >
          <Plus size={14} /> Circuito
        </button>
      </div>
      <div className="small muted">Cargas de exemplo são editáveis. Seção e condições de instalação começam indefinidas.</div>
      {project.circuits.map((c) => {
        const sz = report.ctx.sizing.get(c.id);
        const connected = topology.circuits.get(c.id)?.connected;
        const errs = report.findings.filter((f) => f.targetId === c.id && f.severity === 'erro').length;
        const power = c.loads.reduce((a, l) => a + l.powerW * l.quantity, 0);
        return (
          <div
            key={c.id}
            className={`card`}
            style={{ cursor: 'pointer', borderColor: selection?.kind === 'circuit' && selection.id === c.id ? 'var(--accent)' : undefined }}
            onClick={() => select({ kind: 'circuit', id: c.id })}
          >
            <div className="row">
              <b>C{c.number}</b>
              <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name}
              </span>
              {errs ? <Badge kind="erro">{errs} erro(s)</Badge> : connected ? <Badge kind="ok">ligado</Badge> : <Badge kind="alerta">não ligado</Badge>}
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {c.connection} · {formatNumberBR(power, 0)} W · {c.sectionMm2 !== null ? `${formatNumberBR(c.sectionMm2)} mm²` : 'seção ?'} · Ib {sz?.designCurrentA ? `${formatNumberBR(sz.designCurrentA)} A` : '—'}
            </div>
          </div>
        );
      })}
      {!project.circuits.length && <div className="empty">Nenhum circuito. Adicione um acima.</div>}
    </div>
  );
}
