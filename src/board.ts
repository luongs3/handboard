import {
  BoxGeometry,
  CanvasTexture,
  createSystem,
  Entity,
  Grabbed,
  Mesh,
  MeshStandardMaterial,
  OneHandGrabbable,
  DistanceGrabbable,
  MovementMode,
  RayInteractable,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';
import { BoardModel, COLUMNS, type Card, type ColumnId } from './board-model.js';

/**
 * Handboard: a hands-first morning planning board. Cards are physical tiles
 * you pinch and drop into a column; the column a card lands in is its state.
 * No controller, no keyboard, no menu.
 */

const BOARD_Z = -1.15;
const BOARD_Y = 1.25;
const COL_W = 0.42;
const CARD_W = 0.34;
const CARD_H = 0.11;
const COL_COLORS: Record<ColumnId, string> = {
  todo: '#3b82f6',
  doing: '#f59e0b',
  done: '#22c55e',
};

function columnX(i: number): number {
  return (i - 1) * (COL_W + 0.04);
}

function cardTexture(card: Card, column: ColumnId): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 166;
  const g = c.getContext('2d')!;
  g.fillStyle = '#16181d';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = COL_COLORS[column];
  g.fillRect(0, 0, 14, c.height);
  g.fillStyle = column === 'done' ? '#8b929e' : '#f5f6f8';
  g.font = '600 46px system-ui, sans-serif';
  g.fillText(card.title, 36, 72, 460);
  if (column === 'done') {
    g.fillRect(36, 58, Math.min(460, g.measureText(card.title).width), 4);
  }
  g.fillStyle = '#9aa3b2';
  g.font = '32px system-ui, sans-serif';
  g.fillText(`${card.minutes} min`, 36, 130);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function headerTexture(label: string, color: string, count: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#0b0c0f';
  g.font = '700 50px system-ui, sans-serif';
  g.fillText(label, 24, 64);
  g.font = '600 40px system-ui, sans-serif';
  g.fillText(count, 512 - 24 - g.measureText(count).width, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class BoardSystem extends createSystem({
  held: { required: [Grabbed] },
}) {
  private model = new BoardModel(window.localStorage);
  private cards = new Map<string, { entity: Entity; mesh: Mesh }>();
  private headers = new Map<ColumnId, Mesh>();
  private wasHeld = new Set<string>();
  private tmp = new Vector3();

  init(): void {
    const geo = new BoxGeometry(COL_W, 0.9, 0.01);
    COLUMNS.forEach((col, i) => {
      const lane = new Mesh(
        geo,
        new MeshStandardMaterial({ color: '#23262d', roughness: 0.95, transparent: true, opacity: 0.85 }),
      );
      lane.position.set(columnX(i), BOARD_Y - 0.05, BOARD_Z - 0.02);
      this.world.createTransformEntity(lane);

      const header = new Mesh(
        new BoxGeometry(COL_W, 0.08, 0.012),
        new MeshStandardMaterial(),
      );
      header.position.set(columnX(i), BOARD_Y + 0.45, BOARD_Z - 0.01);
      this.world.createTransformEntity(header);
      this.headers.set(col.id, header);
    });

    const cardGeo = new BoxGeometry(CARD_W, CARD_H, 0.018);
    for (const card of this.model.cards) {
      const mesh = new Mesh(cardGeo, new MeshStandardMaterial({ roughness: 0.6 }));
      const entity = this.world.createTransformEntity(mesh);
      entity.addComponent(RayInteractable);
      // Near pinch grabs with OneHand; far pinch via ray grabs with Distance.
      entity.addComponent(DistanceGrabbable, {
        movementMode: MovementMode.MoveFromTarget,
        rotate: false,
        scale: false,
      });
      this.cards.set(card.id, { entity, mesh });
    }
    void OneHandGrabbable;
    this.layout();

    (window as any).handboard = {
      model: this.model,
      drop: (id: string, col: ColumnId) => this.drop(id, col),
    };
  }

  /** Put every card at its slot in its column and refresh visuals. */
  private layout(): void {
    COLUMNS.forEach((col, i) => {
      const inCol = this.model.inColumn(col.id);
      inCol.forEach((card, slot) => {
        const c = this.cards.get(card.id)!;
        c.mesh.position.set(columnX(i), BOARD_Y + 0.32 - slot * (CARD_H + 0.025), BOARD_Z);
        const mat = c.mesh.material as MeshStandardMaterial;
        mat.map?.dispose();
        mat.map = cardTexture(card, col.id);
        mat.needsUpdate = true;
      });
      const total = inCol.reduce((s, c) => s + c.minutes, 0);
      const h = this.headers.get(col.id)!;
      const hm = h.material as MeshStandardMaterial;
      hm.map?.dispose();
      hm.map = headerTexture(col.label, COL_COLORS[col.id], `${inCol.length} · ${total}m`);
      hm.needsUpdate = true;
    });
  }

  private drop(id: string, column: ColumnId): void {
    const moved = this.model.move(id, column);
    this.layout();
    (window as any).handboardLast = { id, column, moved };
  }

  private columnAt(x: number): ColumnId {
    let best: ColumnId = 'todo';
    let bestD = Infinity;
    COLUMNS.forEach((col, i) => {
      const d = Math.abs(x - columnX(i));
      if (d < bestD) {
        bestD = d;
        best = col.id;
      }
    });
    return best;
  }

  update(): void {
    const heldNow = new Set<string>();
    for (const [id, c] of this.cards) {
      if (c.entity.hasComponent(Grabbed)) heldNow.add(id);
    }
    // A card that was held last frame and isn't now has been released: file it.
    for (const id of this.wasHeld) {
      if (!heldNow.has(id)) {
        const c = this.cards.get(id)!;
        c.mesh.getWorldPosition(this.tmp);
        this.drop(id, this.columnAt(this.tmp.x));
      }
    }
    this.wasHeld = heldNow;
  }
}
