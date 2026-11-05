import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BoardModel, DOING_LIMIT } from '../src/board-model.ts';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

test('moves a card and persists it', () => {
  const s = mem(); const b = new BoardModel(s);
  assert.equal(b.move('c1', 'doing'), true);
  assert.equal(new BoardModel(s).inColumn('doing')[0].id, 'c1');
});
test('enforces the Doing WIP limit', () => {
  const b = new BoardModel(mem());
  for (let i = 1; i <= DOING_LIMIT; i++) assert.equal(b.move('c' + i, 'doing'), true);
  assert.equal(b.move('c5', 'doing'), false);
  assert.equal(b.inColumn('doing').length, DOING_LIMIT);
});
test('minutes left drops when a card is done', () => {
  const b = new BoardModel(mem()); const before = b.minutesLeft();
  b.move('c5', 'done'); assert.equal(b.minutesLeft(), before - 90);
});
test('dropping on own column is a no-op', () => {
  const b = new BoardModel(mem()); assert.equal(b.move('c1', 'todo'), false);
});
