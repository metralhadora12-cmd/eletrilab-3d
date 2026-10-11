import { useMemo, useState } from 'react';
import { BookOpen, Copy, FolderOpen, HelpCircle, Scale, Settings, Trash2, Trophy, Upload } from 'lucide-react';
import { useUiStore } from '../../app/uiStore';
import { useProjectStore } from '../../app/projectStore';
import { repo } from '../../app/repo';
import { EXAMPLES } from '../../persistence/examples';
import { ALL_RULES, VERIFICATION_LABEL, ruleDocumentTitle, ruleEdition } from '../../normative/registry';
import { DOCUMENTS } from '../../normative/sources';
import { getAmpacityDataset, GROUPING_INFO, MINIMUM_SECTION_INFO, TEMPERATURE_FACTOR_INFO } from '../../normative/data/referenceData';
import { registerCatalogItems } from '../../catalog';
import { LEVELS } from '../../education/content';
import { performanceReport } from '../../education/progress';
import { useAcademyStore } from '../../education/academyStore';
import { Badge, Modal } from '../ui/primitives';
import { exportProjectFile, importProjectFile } from './TopBar';
import { pickFile } from '../download';
import type { AutosaveRecord } from '../../persistence/storage';

export function Dialogs() {
  const dialog = useUiStore((s) => s.dialog);
  const close = () => useUiStore.getState().set({ dialog: null });
  const lesson = useAcademyStore((s) => s.openLesson);
  return (
    <>
      {dialog === 'projetos' && <ProjectsDialog onClose={close} />}
      {dialog === 'configuracoes' && <SettingsDialog onClose={close} />}
      {dialog === 'ajuda' && <HelpDialog onClose={close} />}
      {dialog === 'regras' && <RulesDialog onClose={close} />}
      {dialog === 'relatorio' && <ReportDialog onClose={close} />}
      {lesson && <LessonDialog id={lesson} onClose={() => useAcademyStore.getState().set({ openLesson: null })} />}
    </>
  );
}

function ProjectsDialog({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState(() => repo.list());
  const ui = useUiStore.getState();
  const open = (p: Parameters<ReturnType<typeof useProjectStore.getState>['load']>[0], saved: boolean) => {
    const st = useProjectStore.getState();
    if (st.dirty && !window.confirm('Descartar alterações não salvas do projeto atual?')) return;
    st.load(p, { saved });
    ui.select(null);
    ui.requestCamera('frame');
    onClose();
  };
  return (
    <Modal title="Projetos" icon={<FolderOpen size={16} />} onClose={onClose}>
      <div className="stack">
        <div className="row">
          <b className="grow">Projetos salvos neste navegador</b>
          <button className="btn sm" onClick={importProjectFile}>
            <Upload size={13} /> Importar JSON
          </button>
          <button className="btn sm" onClick={exportProjectFile}>
            Exportar atual
          </button>
        </div>
        {list.map((s) => (
          <div key={s.id} className="card row">
            <div className="grow">
              <b>{s.name}</b>
              <div className="small muted">
                {new Date(s.updatedAt).toLocaleString('pt-BR')} · {s.circuits} circuitos · {s.devices} dispositivos
              </div>
            </div>
            <button
              className="btn sm primary"
              onClick={() => {
                const r = repo.load(s.id);
                if (r.ok) open(r.project, true);
                else ui.toast('error', r.errors.join('; '));
              }}
            >
              Abrir
            </button>
            <button
              className="btn sm icon"
              title="Duplicar"
              onClick={() => {
                repo.duplicate(s.id);
                setList(repo.list());
              }}
            >
              <Copy size={13} />
            </button>
            <button
              className="btn sm icon danger"
              title="Excluir"
              onClick={() => {
                if (!window.confirm(`Excluir "${s.name}" do armazenamento local?`)) return;
                repo.delete(s.id);
                setList(repo.list());
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {!list.length && <div className="empty">Nenhum projeto salvo ainda (Ctrl+S salva o projeto atual).</div>}
        <b style={{ marginTop: 8 }}>Projetos de exemplo</b>
        {EXAMPLES.map((ex) => (
          <div key={ex.id} className="card row">
            <div className="grow">
              <b>{ex.title}</b>
              <div className="small muted">{ex.description}</div>
            </div>
            <button className="btn sm" onClick={() => open(ex.build(), false)}>
              Abrir exemplo
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const ui = useUiStore();
  const project = useProjectStore((s) => s.project);
  const progress = useAcademyStore((s) => s.progress);
  const importCatalog = async () => {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    try {
      const r = registerCatalogItems(JSON.parse(await f.text()));
      if (r.errors.length) ui.toast('error', `Catálogo rejeitado: ${r.errors.slice(0, 3).join(' | ')}`);
      else ui.toast('ok', `${r.added} item(ns) de catálogo validados e registrados nesta sessão.`);
    } catch (e) {
      ui.toast('error', `JSON inválido: ${(e as Error).message}`);
    }
  };
  return (
    <Modal title="Configurações" icon={<Settings size={16} />} onClose={onClose} narrow>
      <div className="stack">
        <div className="field">
          <span className="label">Perfil de validação do projeto</span>
          <select className="select" value={project.validationProfile} onChange={(e) => useProjectStore.getState().setValidationProfile(e.target.value as never)}>
            <option value="aprendizado">Aprendizado — permite experimentar e explica os problemas</option>
            <option value="tecnico">Validação técnica — bloqueia ligações incompatíveis e destaca dados ausentes</option>
            <option value="desafio">Desafio — avalia pelos critérios da atividade</option>
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={ui.showFlow} onChange={(e) => ui.set({ showFlow: e.target.checked })} /> Mostrar fluxo de corrente na simulação
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={progress.unlockAll}
            onChange={(e) => useAcademyStore.getState().update((p) => ({ ...p, unlockAll: e.target.checked }))}
          />{' '}
          Modo professor: liberar todos os níveis da Academia
        </label>
        <div className="card">
          <b>Catálogo de componentes</b>
          <div className="small muted" style={{ margin: '4px 0 8px' }}>
            Importe itens (JSON) validados por schema. Itens comerciais exigem fabricante, modelo e ficha técnica com URL verificável.
          </div>
          <button className="btn sm" onClick={importCatalog}>
            <Upload size={13} /> Importar itens de catálogo
          </button>
        </div>
        <button
          className="btn danger sm"
          onClick={() => {
            if (!window.confirm('Apagar todo o progresso da Academia?')) return;
            useAcademyStore.getState().update(() => ({ attempts: [], hintsUsed: {}, completed: {}, lessonsRead: [], unlockAll: false }));
          }}
        >
          Reiniciar progresso da Academia
        </button>
      </div>
    </Modal>
  );
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  const keys: Array<[string, string]> = [
    ['Ctrl+Z / Ctrl+Y', 'Desfazer / refazer'],
    ['Ctrl+S', 'Salvar projeto'],
    ['Ctrl+O', 'Abrir projetos'],
    ['Del', 'Remover seleção'],
    ['Esc', 'Cancelar ferramenta / seleção'],
    ['V / W / I', 'Selecionar / Fio / Instrumentos'],
    ['F', 'Enquadrar o quadro'],
    ['1 / 2 / 3 / 4', 'Perspectiva / frontal ortográfica / bornes / lateral'],
    ['D / C / T / X', 'Porta / tampa / transparência / corte'],
    ['U', 'Alternar 3D ↔ diagrama unifilar'],
    ['E', 'Energizar/desenergizar (modo Simulação)'],
    ['F1', 'Ajuda'],
  ];
  return (
    <Modal title="Ajuda, atalhos e limitações" icon={<HelpCircle size={16} />} onClose={onClose}>
      <div className="stack">
        <div className="warn-box">
          <b>Ferramenta educacional.</b> O EletriLab 3D não substitui projeto elétrico, profissional legalmente habilitado, inspeções ou ensaios de campo. Nenhum resultado constitui declaração de conformidade com a ABNT NBR 5410.
        </div>
        <div className="card">
          <b>Fluxo básico</b>
          <ol style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
            <li>Defina alimentação e esquema de aterramento (painel direito, sem seleção).</li>
            <li>Cadastre os circuitos (aba Circuitos) com cargas e condições de instalação.</li>
            <li>Arraste componentes da Biblioteca para os trilhos DIN.</li>
            <li>Use a ferramenta Fio para ligar bornes (cor e seção na biblioteca).</li>
            <li>Acompanhe o terminal de Diagnóstico e o diagrama unifilar.</li>
            <li>No modo Simulação, energize, manobre, injete falhas e use os instrumentos.</li>
          </ol>
        </div>
        <table className="data">
          <tbody>
            {keys.map(([k, d]) => (
              <tr key={k}>
                <td>
                  <span className="kbd">{k}</span>
                </td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="card small">
          <b>Principais simplificações</b>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.55 }}>
            <li>Regime permanente senoidal; cargas de impedância constante; reatâncias de condutores desprezadas no solver.</li>
            <li>Disparo magnético no limite superior da curva; modelo térmico didático (não é curva de fabricante); DR atua em IΔn.</li>
            <li>Seletividade, energia I²t de passagem e harmônicas não são modeladas.</li>
            <li>Surtos e corrente no corpo humano são ilustrativos.</li>
            <li>Capacidade de condução: subconjunto de dados de fonte secundária (métodos A1, A2, B1, C; cobre).</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}

function RulesDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<'todas' | 'normativa' | 'heuristica'>('todas');
  const rules = ALL_RULES.filter((r) => kind === 'todas' || r.kind === kind);
  const amp = getAmpacityDataset().info;
  return (
    <Modal title="Regras técnicas (NormativeRules) e fontes" icon={<Scale size={16} />} onClose={onClose}>
      <div className="stack">
        <div className="info-box">
          Regras normativas foram implementadas a partir de fontes técnicas secundárias; o texto primário das normas não foi acessado. Heurísticas são critérios didáticos e não exigências normativas. Status "fonte secundária" significa que a regra requer conferência na edição vigente.
        </div>
        <div className="seg">
          {(['todas', 'normativa', 'heuristica'] as const).map((k) => (
            <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
              {k === 'todas' ? `Todas (${ALL_RULES.length})` : k === 'normativa' ? 'Normativas' : 'Heurísticas'}
            </button>
          ))}
        </div>
        {rules.map((r) => (
          <div key={r.id} className="card">
            <div className="row">
              <b className="grow">{r.title}</b>
              <Badge kind={r.kind === 'normativa' ? 'info' : 'neutral'}>{r.kind}</Badge>
              <Badge kind={r.verification.status === 'pendente' ? 'inconclusivo' : r.verification.status === 'didatico' ? 'neutral' : 'alerta'}>{VERIFICATION_LABEL[r.verification.status]}</Badge>
            </div>
            <div className="small mono faint">{r.id}</div>
            <div className="small" style={{ marginTop: 4 }}>
              {r.description}
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              Fonte: {ruleDocumentTitle(r)} · edição {ruleEdition(r)} · item {r.source.clause}
              {r.source.clauseConfirmed ? '' : ' (numeração a confirmar)'}
            </div>
            <div className="small muted">Aplicabilidade: {r.applicability}</div>
            {Object.keys(r.parameters).length > 0 && (
              <div className="small muted">
                Parâmetros: {Object.entries(r.parameters).map(([k, v]) => `${k} = ${v}`).join(' · ')}
              </div>
            )}
            <div className="small" style={{ marginTop: 4, color: '#b9d9f3' }}>
              {r.didacticMessage}
            </div>
            <div className="small faint">
              Severidade padrão: {r.severity} · {r.verification.notes} · revisão {r.verification.reviewedAt}
            </div>
          </div>
        ))}
        <b>Documentos de referência</b>
        {Object.values(DOCUMENTS).map((d) => (
          <div key={d.id} className="card small">
            <b>{d.title}</b>
            <div className="muted">
              Edição: {d.edition} — {d.editionStatus}
            </div>
          </div>
        ))}
        <b>Conjuntos de dados</b>
        {[amp, TEMPERATURE_FACTOR_INFO, GROUPING_INFO, MINIMUM_SECTION_INFO].map((d) => (
          <div key={d.id} className="card small">
            <div className="row">
              <b className="grow">{d.description}</b>
              <Badge kind="alerta">{d.status}</Badge>
            </div>
            <div className="muted">{d.reference}</div>
            <div className="faint">{d.notes}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function ReportDialog({ onClose }: { onClose: () => void }) {
  const progress = useAcademyStore((s) => s.progress);
  const rep = useMemo(() => performanceReport(progress), [progress]);
  return (
    <Modal title="Relatório de desempenho — Academia Elétrica" icon={<Trophy size={16} />} onClose={onClose}>
      <div className="stack">
        <div className="grid2">
          <div className="card">
            <div className="small muted">Pontuação</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              {rep.earned} / {rep.total}
            </div>
            <div className="progress" style={{ marginTop: 6 }}>
              <div style={{ width: `${rep.percent}%` }} />
            </div>
          </div>
          <div className="card">
            <div className="small muted">Tentativas</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{rep.attempts}</div>
            <div className="small muted">
              Taxa de sucesso {Math.round(rep.successRate)} % · dicas usadas {rep.hintsUsed}
            </div>
          </div>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Nível</th>
              <th>Aulas lidas</th>
              <th>Desafios</th>
            </tr>
          </thead>
          <tbody>
            {rep.levels.map((l) => (
              <tr key={l.level}>
                <td>
                  {l.level}. {l.title}
                </td>
                <td>
                  {l.lessonsRead}/{l.lessons}
                </td>
                <td>
                  {l.completed}/{l.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="card">
          <b>Pontos a revisar (mais frequentes nas tentativas sem sucesso)</b>
          {rep.frequentIssues.length ? (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {rep.frequentIssues.map(([n, c]) => (
                <li key={n} className="small">
                  {n} <span className="faint">({c}×)</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="small muted">Nada registrado ainda.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function LessonDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const lesson = LEVELS.flatMap((l) => l.lessons).find((l) => l.id === id);
  if (!lesson) return null;
  const markRead = () => useAcademyStore.getState().update((p) => (p.lessonsRead.includes(id) ? p : { ...p, lessonsRead: [...p.lessonsRead, id] }));
  return (
    <Modal
      title={lesson.title}
      icon={<BookOpen size={16} />}
      onClose={() => {
        markRead();
        onClose();
      }}
      footer={
        <button
          className="btn primary"
          onClick={() => {
            markRead();
            onClose();
          }}
        >
          Concluir leitura
        </button>
      }
    >
      <div className="lesson">
        {lesson.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <div className="card">
          <b>Pontos-chave</b>
          <ul>
            {lesson.keyPoints.map((k, i) => (
              <li key={i}>{k}</li>
            ))}
          </ul>
        </div>
        {lesson.ruleRefs && (
          <div className="small muted" style={{ marginTop: 8 }}>
            Regras relacionadas: {lesson.ruleRefs.join(', ')} (ver "Regras técnicas e fontes").
          </div>
        )}
      </div>
    </Modal>
  );
}

export function RecoverDialog({ record, onClose }: { record: AutosaveRecord; onClose: () => void }) {
  return (
    <Modal
      title="Recuperar sessão anterior?"
      onClose={onClose}
      narrow
      footer={
        <>
          <button
            className="btn"
            onClick={() => {
              repo.clearAutosave();
              onClose();
            }}
          >
            Descartar
          </button>
          <button
            className="btn primary"
            onClick={() => {
              useProjectStore.getState().load(record.project);
              useUiStore.getState().requestCamera('frame');
              useUiStore.getState().toast('ok', 'Sessão recuperada.');
              onClose();
            }}
          >
            Recuperar
          </button>
        </>
      }
    >
      <div className="stack">
        <div>
          Foi encontrado um salvamento automático de <b>{record.project.name}</b> em {new Date(record.savedAt).toLocaleString('pt-BR')}.
        </div>
        <div className="small muted">
          {record.project.circuits.length} circuitos · {record.project.devices.length} dispositivos · {record.project.wires.length} condutores. O arquivo foi validado antes de ser oferecido.
        </div>
      </div>
    </Modal>
  );
}
