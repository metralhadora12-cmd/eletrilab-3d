/**
 * Projetos de exemplo construídos programaticamente.
 * Os valores de carga, comprimento e condições de instalação são FICTÍCIOS e didáticos.
 */
import { createCircuit, createDevice, createEmptyProject, createWire } from '../model/factory';
import type { Circuit, CircuitKind, DeviceConfig, Project, Supply, WireColor } from '../model/schema';

export class Builder {
  p: Project;
  constructor(name: string, description: string, supply: Partial<Supply> = {}) {
    this.p = createEmptyProject(name, { description });
    this.p.supply = { ...this.p.supply, ...supply };
  }
  dev(catalogId: string, row: number, module: number, label: string, config: DeviceConfig = {}, on = true): string {
    const d = createDevice(catalogId, row, module, label);
    d.config = { ...d.config, ...config };
    if (on && (d.state === 'off' || d.state === 'on')) d.state = 'on';
    this.p.devices.push(d);
    return d.id;
  }
  wire(from: [string, string], to: [string, string], color: WireColor, section: number) {
    const w = createWire({ owner: from[0], terminal: from[1] }, { owner: to[0], terminal: to[1] }, color, section);
    this.p.wires.push(w);
    return w.id;
  }
  circuit(kind: CircuitKind, o: Partial<Circuit>): string {
    const c = createCircuit(this.p, kind, o);
    this.p.circuits.push(c);
    return `circ:${c.id}`;
  }
}

const INSTALL = { method: 'B1' as const, ambientTempC: 30, groupedCircuits: 3 };

export interface ResidenceOptions {
  defects?: boolean;
}

/** Residência fictícia 127/220 V, bifásica, TN-S, com DR para áreas molhadas e DPS na origem. */
export function buildResidenceExample(opts: ResidenceOptions = {}): Project {
  const b = new Builder(
    opts.defects ? 'Diagnóstico — quadro com defeitos' : 'Residência exemplo (127/220 V, TN-S)',
    opts.defects
      ? 'Quadro com defeitos propositais de montagem e dimensionamento para atividades de diagnóstico.'
      : 'Residência fictícia com cinco circuitos: iluminação, tomadas gerais, cozinha (DR), chuveiro F-F (DR) e lavanderia (DR). Valores didáticos.',
    {
      type: 'bifasico',
      systemVoltage: '127/220',
      earthing: 'TN-S',
      prospectiveShortCircuitKA: 3,
      earthElectrodeResistanceOhm: 20,
      sourceEarthResistanceOhm: 10,
      upstreamVoltageDropPct: 1,
    },
  );
  const c1 = b.circuit('iluminacao', {
    name: 'Iluminação social',
    locations: ['sala', 'circulacao'],
    loads: [{ id: 'ld-c1', name: 'Luminárias LED', kind: 'iluminacao', powerW: 10, powerFactor: 0.92, efficiency: 1, quantity: 12 }],
    lengthM: 18,
    ...INSTALL,
    sectionMm2: 1.5,
  });
  const c2 = b.circuit('tug', {
    name: 'Tomadas sala e quartos',
    locations: ['sala', 'quarto'],
    loads: [{ id: 'ld-c2', name: 'Previsão de tomadas', kind: 'misto', powerW: 100, powerFactor: 0.9, efficiency: 1, quantity: 8 }],
    lengthM: 20,
    ...INSTALL,
    sectionMm2: opts.defects ? 1.5 : 2.5,
  });
  const c3 = b.circuit('tug', {
    name: 'Tomadas da cozinha',
    locations: ['cozinha'],
    loads: [{ id: 'ld-c3', name: 'Tomadas da cozinha', kind: 'misto', powerW: 600, powerFactor: 0.9, efficiency: 1, quantity: 3 }],
    lengthM: 12,
    ...INSTALL,
    sectionMm2: 2.5,
  });
  const c4 = b.circuit('chuveiro', {
    name: 'Chuveiro',
    connection: 'F-F',
    locations: ['banheiro'],
    loads: [{ id: 'ld-c4', name: 'Chuveiro 5500 W', kind: 'resistiva', powerW: 5500, powerFactor: 1, efficiency: 1, quantity: 1 }],
    lengthM: 10,
    ...INSTALL,
    sectionMm2: 6,
  });
  const c5 = b.circuit('maquina-lavar', {
    name: 'Lavanderia',
    locations: ['area-servico', 'lavanderia'],
    loads: [{ id: 'ld-c5', name: 'Máquina de lavar (absorvida)', kind: 'motor', powerW: 1000, powerFactor: 0.8, efficiency: 1, quantity: 1 }],
    lengthM: 14,
    ...INSTALL,
    sectionMm2: 2.5,
  });

  const dg = b.dev('disj-generico-2p', 0, 0, 'DG', { ratedCurrentA: 50, curve: 'C', breakingCapacityKA: 4.5 });
  const xd1 = b.dev('borne-distribuicao', 0, 3, 'XD1');
  const xd2 = b.dev('borne-distribuicao', 0, 5, 'XD2');
  const spd = { ucV: 175, upKV: 1.5, inKA: 20, imaxKA: 40 };
  const dps1 = b.dev('dps-generico-t2', 0, 8, 'DPS1', spd);
  const dps2 = b.dev('dps-generico-t2', 0, 9, 'DPS2', spd);
  const dps3 = b.dev('dps-generico-t2', 0, 10, 'DPS3', spd);
  const dr1 = b.dev('dr-generico-4p', 0, 13, 'DR1', { ratedCurrentA: 63, residualCurrentMA: 30, rcdType: 'A' });
  const q1 = b.dev('disj-generico-1p', 1, 0, 'Q1', { ratedCurrentA: 10, curve: 'C', breakingCapacityKA: 4.5 });
  const q2 = b.dev('disj-generico-1p', 1, 1, 'Q2', { ratedCurrentA: 16, curve: 'C', breakingCapacityKA: 4.5 });
  const q3 = b.dev('disj-generico-1p', 1, 3, 'Q3', { ratedCurrentA: 16, curve: 'C', breakingCapacityKA: 4.5 });
  const q5 = b.dev('disj-generico-1p', 1, 4, 'Q5', { ratedCurrentA: 16, curve: 'C', breakingCapacityKA: 4.5 });
  const q4 = b.dev('disj-generico-2p', 1, 5, 'Q4', { ratedCurrentA: 25, curve: 'C', breakingCapacityKA: 4.5 });
  const bn1 = b.dev('barra-n-din', 1, 9, 'BN1');

  const E = 'entrada';
  const BN = 'barra-n';
  const BP = 'barra-pe';
  // Entrada
  b.wire([E, 'L1'], [dg, 'T1'], 'preto', 10);
  b.wire([E, 'L2'], [dg, 'T2'], 'vermelho', 10);
  b.wire([E, 'N'], [BN, 'N1'], 'azul-claro', 10);
  b.wire([E, 'PE'], [BP, 'PE1'], 'verde-amarelo', 10);
  // Distribuição a partir do geral
  b.wire([dg, 'B1'], [xd1, 'IN'], 'preto', 10);
  b.wire([dg, 'B2'], [xd2, 'IN'], 'vermelho', 10);
  b.wire([xd1, 'O1'], [dr1, 'T1'], 'preto', 10);
  b.wire([xd1, 'O2'], [dps1, 'L'], 'preto', 4);
  b.wire([xd1, 'O3'], [q1, 'T1'], 'preto', 10);
  b.wire([xd2, 'O1'], [dr1, 'T2'], 'vermelho', 10);
  b.wire([xd2, 'O2'], [dps2, 'L'], 'vermelho', 4);
  b.wire([xd2, 'O3'], [q2, 'T1'], 'vermelho', 10);
  b.wire([BN, 'N2'], [dr1, 'TN'], 'azul-claro', 10);
  b.wire([BN, 'N3'], [dps3, 'L'], 'azul-claro', 4);
  b.wire([dps1, 'PE'], [BP, 'PE2'], 'verde-amarelo', 4);
  b.wire([dps2, 'PE'], [BP, 'PE3'], 'verde-amarelo', 4);
  b.wire([dps3, 'PE'], [BP, 'PE4'], 'verde-amarelo', 4);
  // Saídas do DR
  b.wire([dr1, 'B1'], [q3, 'T1'], 'preto', 10);
  b.wire([dr1, 'B1'], [q4, 'T1'], 'preto', 10);
  b.wire([dr1, 'B2'], [q5, 'T1'], 'vermelho', 10);
  b.wire([dr1, 'B2'], [q4, 'T2'], 'vermelho', 10);
  b.wire([dr1, 'BN'], [bn1, 'T1'], 'azul-claro', 10);
  // Circuitos terminais
  b.wire([q1, 'B1'], [c1, 'L1'], 'preto', 1.5);
  b.wire([q2, 'B1'], [c2, 'L1'], 'vermelho', opts.defects ? 1.5 : 2.5);
  b.wire([q3, 'B1'], [c3, 'L1'], 'preto', 2.5);
  b.wire([q5, 'B1'], [c5, 'L1'], 'vermelho', 2.5);
  b.wire([q4, 'B1'], [c4, 'L1'], 'preto', 6);
  b.wire([q4, 'B2'], [c4, 'L2'], 'vermelho', 6);
  b.wire([BN, 'N4'], [c1, 'N'], opts.defects ? 'preto' : 'azul-claro', 1.5);
  b.wire([BN, 'N5'], [c2, 'N'], 'azul-claro', opts.defects ? 1.5 : 2.5);
  if (opts.defects) b.wire([BN, 'N6'], [c3, 'N'], 'azul-claro', 2.5);
  else b.wire([bn1, 'T2'], [c3, 'N'], 'azul-claro', 2.5);
  b.wire([bn1, 'T3'], [c5, 'N'], 'azul-claro', 2.5);
  b.wire([BP, 'PE5'], [c1, 'PE'], 'verde-amarelo', 1.5);
  b.wire([BP, 'PE6'], [c2, 'PE'], 'verde-amarelo', opts.defects ? 1.5 : 2.5);
  b.wire([BP, 'PE7'], [c3, 'PE'], 'verde-amarelo', 2.5);
  b.wire([BP, 'PE8'], [c4, 'PE'], 'verde-amarelo', 6);
  if (!opts.defects) b.wire([BP, 'PE9'], [c5, 'PE'], 'verde-amarelo', 2.5);
  return b.p;
}

export function buildEmptyExample(): Project {
  const b = new Builder('Quadro vazio — montagem livre', 'Quadro com alimentação bifásica 127/220 V (TN-S) e trilhos vazios.', {
    prospectiveShortCircuitKA: 3,
  });
  return b.p;
}

export interface ExampleEntry {
  id: string;
  title: string;
  description: string;
  build: () => Project;
}

export const EXAMPLES: ExampleEntry[] = [
  {
    id: 'residencia',
    title: 'Residência exemplo (127/220 V, TN-S)',
    description: 'Quadro completo com DG, DPS, DR 30 mA e cinco circuitos dimensionados.',
    build: () => buildResidenceExample(),
  },
  {
    id: 'vazio',
    title: 'Quadro vazio — montagem livre',
    description: 'Comece do zero: escolha componentes, monte e ligue.',
    build: buildEmptyExample,
  },
  {
    id: 'diagnostico',
    title: 'Diagnóstico — quadro com defeitos',
    description: 'Encontre e corrija erros de neutro, PE, cores e seção.',
    build: () => buildResidenceExample({ defects: true }),
  },
];
