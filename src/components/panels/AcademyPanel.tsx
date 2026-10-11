import { useState } from 'react';
import { BookOpen, CheckCircle2, ChevronDown, ChevronRight, Circle, Lightbulb, Lock, Play, Trophy, XCircle } from 'lucide-react';
import { LEVELS } from '../../education/content';
import { CHALLENGES, challengesForLevel, evaluateProjectChallenge, type Challenge } from '../../education/challenges';
import { computeScore, isLevelUnlocked, recordAttempt, takeHint } from '../../education/progress';
import { useAcademyStore } from '../../education/academyStore';
import { useProjectStore } from '../../app/projectStore';
import { useUiStore } from '../../app/uiStore';
import { parseDecimalBR, formatNumberBR } from '../../electrical/core/units';
import { Badge } from '../ui/primitives';

export function AcademyPanel() {
  const progress = useAcademyStore((s) => s.progress);
  const active = useAcademyStore((s) => s.activeChallenge);
  const [open, setOpen] = useState<number | null>(1);
  const ch = CHALLENGES.find((c) => c.id === active);
  if (ch) return <ChallengeView ch={ch} />;
  const done = Object.keys(progress.completed).length;
  return (
    <div>
      <div className="panel-body stack">
        <div className="row">
          <Trophy size={16} color="#f2b632" />
          <b className="grow">Academia Elétrica</b>
          <span className="small muted">
            {done}/{CHALLENGES.length} desafios
          </span>
        </div>
        <div className="progress">
          <div style={{ width: `${(100 * done) / CHALLENGES.length}%` }} />
        </div>
      </div>
      {LEVELS.map((l) => {
        const unlocked = isLevelUnlocked(l.id, progress);
        const chs = challengesForLevel(l.id);
        const completed = chs.filter((c) => progress.completed[c.id]).length;
        const isOpen = open === l.id;
        return (
          <div key={l.id}>
            <div className="level-head" onClick={() => setOpen(isOpen ? null : l.id)}>
              <div className={`level-num ${completed === chs.length ? 'done' : ''}`}>{l.id}</div>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{l.title}</div>
                <div className="small muted">
                  {completed}/{chs.length} desafios
                </div>
              </div>
              {!unlocked && <Lock size={14} color="#8e9aab" />}
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
            {isOpen && (
              <div className="panel-body stack">
                <div className="small muted">{l.goal}</div>
                {!unlocked && <div className="warn-box">Conclua ao menos metade dos desafios do nível anterior para liberar (ou habilite "modo professor" nas configurações).</div>}
                <div className="small" style={{ fontWeight: 600 }}>
                  Aulas
                </div>
                {l.lessons.map((ls) => (
                  <button key={ls.id} className="btn sm ghost" style={{ justifyContent: 'flex-start' }} onClick={() => useAcademyStore.getState().set({ openLesson: ls.id })}>
                    {progress.lessonsRead.includes(ls.id) ? <CheckCircle2 size={13} color="#3fb26f" /> : <BookOpen size={13} />} {ls.title}
                  </button>
                ))}
                <div className="small" style={{ fontWeight: 600, marginTop: 4 }}>
                  Desafios
                </div>
                {chs.map((c) => (
                  <div key={c.id} className="card">
                    <div className="row">
                      {progress.completed[c.id] ? <CheckCircle2 size={14} color="#3fb26f" /> : <Circle size={14} color="#66717f" />}
                      <span className="grow">{c.title}</span>
                      <Badge kind="neutral">{c.type === 'quiz' ? 'quiz' : c.type === 'numeric' ? 'cálculo' : 'montagem'}</Badge>
                    </div>
                    <div className="row" style={{ marginTop: 6 }}>
                      <span className="small muted grow">{progress.completed[c.id] ? `${progress.completed[c.id].score}/${c.points} pts` : `até ${c.points} pts`}</span>
                      <button className="btn sm primary" disabled={!unlocked} onClick={() => useAcademyStore.getState().set({ activeChallenge: c.id })}>
                        <Play size={12} /> Abrir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChallengeView({ ch }: { ch: Challenge }) {
  const progress = useAcademyStore((s) => s.progress);
  const update = useAcademyStore((s) => s.update);
  const hints = progress.hintsUsed[ch.id] ?? 0;
  const attempts = progress.attempts.filter((a) => a.challengeId === ch.id);
  return (
    <div>
      <div className="panel-body stack">
        <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => useAcademyStore.getState().set({ activeChallenge: null })}>
          ← Voltar aos níveis
        </button>
        <div className="row">
          <Badge kind="neutral">Nível {ch.level}</Badge>
          <b className="grow">{ch.title}</b>
        </div>
        <div className="small" style={{ lineHeight: 1.5 }}>
          {ch.intro}
        </div>
        <div className="small muted">
          Pontuação possível agora: <b>{computeScore(ch, progress)}</b> / {ch.points} · tentativas: {attempts.length}
          {progress.completed[ch.id] ? ` · melhor: ${progress.completed[ch.id].score}` : ''}
        </div>
      </div>
      <div className="panel-body">
        {ch.type === 'quiz' && <QuizView ch={ch} />}
        {ch.type === 'numeric' && <NumericView ch={ch} />}
        {ch.type === 'project' && <ProjectView ch={ch} />}
      </div>
      <div className="panel-body stack">
        <div className="row">
          <Lightbulb size={14} color="#f2b632" />
          <b className="grow">Dicas graduais</b>
          <button className="btn sm" disabled={hints >= ch.hints.length} onClick={() => update((p) => takeHint(p, ch))}>
            Mostrar dica (−15 %)
          </button>
        </div>
        {ch.hints.slice(0, hints).map((h, i) => (
          <div key={i} className="info-box">
            {i + 1}. {h}
          </div>
        ))}
      </div>
      {attempts.length > 0 && (
        <div className="panel-body stack">
          <b className="small">Histórico de tentativas</b>
          {[...attempts].reverse().slice(0, 6).map((a, i) => (
            <div key={i} className="small row">
              {a.passed ? <CheckCircle2 size={13} color="#3fb26f" /> : <XCircle size={13} color="#e5534b" />}
              <span className="grow muted">{new Date(a.at).toLocaleString('pt-BR')}</span>
              <span>{a.score} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function finish(ch: Challenge, passed: boolean, notes: string[]) {
  const ui = useUiStore.getState();
  useAcademyStore.getState().update((p) => recordAttempt(p, ch, passed, notes));
  ui.toast(passed ? 'ok' : 'warn', passed ? `Desafio concluído: ${ch.title}` : 'Ainda não foi desta vez — revise os itens indicados.');
}

function QuizView({ ch }: { ch: Extract<Challenge, { type: 'quiz' }> }) {
  const [answers, setAnswers] = useState<Array<number | null>>(ch.questions.map(() => null));
  const [checked, setChecked] = useState(false);
  return (
    <div className="stack">
      {ch.questions.map((q, qi) => (
        <div key={qi} className="card">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {qi + 1}. {q.prompt}
          </div>
          {q.options.map((o, oi) => {
            const cls = checked ? (oi === q.correct ? 'right' : answers[qi] === oi ? 'wrong' : '') : answers[qi] === oi ? 'on' : '';
            return (
              <div key={oi} className={`quiz-opt ${cls}`} onClick={() => !checked && setAnswers(answers.map((a, i) => (i === qi ? oi : a)))}>
                {answers[qi] === oi ? '●' : '○'} {o}
              </div>
            );
          })}
          {checked && <div className="small muted" style={{ marginTop: 6 }}>{q.explanation}</div>}
        </div>
      ))}
      {!checked ? (
        <button
          className="btn primary"
          disabled={answers.some((a) => a === null)}
          onClick={() => {
            setChecked(true);
            const wrong = ch.questions.filter((q, i) => answers[i] !== q.correct).map((q) => q.prompt);
            finish(ch, wrong.length === 0, wrong);
          }}
        >
          Verificar respostas
        </button>
      ) : (
        <button
          className="btn"
          onClick={() => {
            setChecked(false);
            setAnswers(ch.questions.map(() => null));
          }}
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

function NumericView({ ch }: { ch: Extract<Challenge, { type: 'numeric' }> }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<null | { ok: boolean; expected: number; given: number }>(null);
  return (
    <div className="stack">
      <div className="card">{ch.prompt}</div>
      <div className="row">
        <div className="unit-input grow">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Sua resposta" inputMode="decimal" />
          <span className="unit">{ch.unit}</span>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            const v = parseDecimalBR(text);
            if (v === null) {
              useUiStore.getState().toast('warn', 'Digite um número válido (vírgula ou ponto decimal).');
              return;
            }
            const expected = ch.answer();
            const ok = ch.tolerancePct === 0 ? Math.abs(v - expected) < 1e-9 : Math.abs(v - expected) <= (Math.abs(expected) * ch.tolerancePct) / 100;
            setResult({ ok, expected, given: v });
            finish(ch, ok, ok ? [] : [`resposta ${v} ${ch.unit}`]);
          }}
        >
          Verificar
        </button>
      </div>
      {result && (
        <div className={result.ok ? 'info-box' : 'warn-box'}>
          {result.ok ? 'Correto!' : 'Resposta fora da tolerância.'} Valor calculado pelo motor: <b>{formatNumberBR(result.expected, 3)} {ch.unit}</b>. {ch.explanation}
        </div>
      )}
    </div>
  );
}

function ProjectView({ ch }: { ch: Extract<Challenge, { type: 'project' }> }) {
  const [result, setResult] = useState<ReturnType<typeof evaluateProjectChallenge> | null>(null);
  const loadScenario = () => {
    const st = useProjectStore.getState();
    if (st.dirty && !window.confirm('Carregar o cenário do desafio substituirá o projeto atual (alterações não salvas serão perdidas). Continuar?')) return;
    st.load(ch.setup());
    const ui = useUiStore.getState();
    ui.set({ mode: 'montagem', centerView: '3d', tool: 'select', selection: null, coverOn: false, doorOpen: true });
    ui.requestCamera('frame');
    ui.toast('info', 'Cenário do desafio carregado. Monte, valide e depois clique em "Avaliar montagem".');
    setResult(null);
  };
  return (
    <div className="stack">
      <button className="btn" onClick={loadScenario}>
        <Play size={13} /> Carregar cenário do desafio
      </button>
      <div className="card small">
        <b>Objetivos</b>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {ch.goals.map((g) => (
            <li key={g.id}>
              {result ? (result.goals.find((x) => x.id === g.id)?.met ? '✅ ' : '❌ ') : ''}
              {g.description}
            </li>
          ))}
        </ul>
      </div>
      <button
        className="btn primary"
        onClick={() => {
          const r = evaluateProjectChallenge(ch, useProjectStore.getState().project);
          setResult(r);
          finish(ch, r.passed, [...r.goals.filter((g) => !g.met).map((g) => g.description), ...r.critical.slice(0, 5)]);
        }}
      >
        Avaliar montagem
      </button>
      {result && !result.passed && result.critical.length > 0 && (
        <div className="warn-box">
          <b>Falhas críticas que impedem a conclusão:</b>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {result.critical.slice(0, 8).map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      {result?.passed && <div className="info-box">Montagem aprovada pelos critérios da atividade. Lembre: isso não equivale a conformidade normativa de uma instalação real.</div>}
    </div>
  );
}
