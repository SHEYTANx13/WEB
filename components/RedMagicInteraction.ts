export type RedMagicInteractionType =
  | "enter"
  | "move"
  | "impact"
  | "flick"
  | "charge"
  | "release"
  | "orbit"
  | "leave";

export type RedMagicInteractionDetail = {
  type: RedMagicInteractionType;

  x: number;
  y: number;

  velocity: number;
  proximity: number;
  energy: number;
  angle: number;

  /**
   * 0..1 while the pointer is being held.
   */
  charge: number;
};

export const RED_MAGIC_INTERACTION_EVENT =
  "red-magic-interaction";

export function emitRedMagicInteraction(
  target: EventTarget,
  detail: RedMagicInteractionDetail
) {
  target.dispatchEvent(
    new CustomEvent<RedMagicInteractionDetail>(
      RED_MAGIC_INTERACTION_EVENT,
      {
        detail,
        bubbles: true
      }
    )
  );
}
