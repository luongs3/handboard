/** Pure board state, no Three.js — unit-testable in Node. */

export type ColumnId = 'todo' | 'doing' | 'done';

export interface Card {
  id: string;
  title: string;
  minutes: number;
  column: ColumnId;
  order: number;
}

export const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'Doing' },
  { id: 'done', label: 'Done' },
];

/** WIP limit for "Doing": the board refuses a third card in progress. */
export const DOING_LIMIT = 2;

const KEY = 'handboard.v1';

export const DEFAULT_CARDS: Card[] = [
  { id: 'c1', title: 'Water + stretch', minutes: 5, column: 'todo', order: 0 },
  { id: 'c2', title: 'Review calendar', minutes: 10, column: 'todo', order: 1 },
  { id: 'c3', title: 'Top 3 priorities', minutes: 10, column: 'todo', order: 2 },
  { id: 'c4', title: 'Inbox to zero', minutes: 20, column: 'todo', order: 3 },
  { id: 'c5', title: 'Deep-work block', minutes: 90, column: 'todo', order: 4 },
];

interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export class BoardModel {
  cards: Card[];
  private store?: Store;

  constructor(store?: Store) {
    this.store = store;
    const raw = store?.getItem(KEY);
    this.cards = raw ? (JSON.parse(raw) as Card[]) : DEFAULT_CARDS.map((c) => ({ ...c }));
  }

  inColumn(col: ColumnId): Card[] {
    return this.cards.filter((c) => c.column === col).sort((a, b) => a.order - b.order);
  }

  /** Move a card to the bottom of `col`. Returns false if the move is refused. */
  move(id: string, col: ColumnId): boolean {
    const card = this.cards.find((c) => c.id === id);
    if (!card) return false;
    if (card.column === col) return false;
    if (col === 'doing' && this.inColumn('doing').length >= DOING_LIMIT) return false;
    const tail = this.inColumn(col);
    card.column = col;
    card.order = tail.length ? tail[tail.length - 1].order + 1 : 0;
    this.store?.setItem(KEY, JSON.stringify(this.cards));
    return true;
  }

  minutesLeft(): number {
    return this.cards.filter((c) => c.column !== 'done').reduce((s, c) => s + c.minutes, 0);
  }
}
