/**
 * @file tests/helpers/dialog.ts
 * @desc Enough of <dialog>'s showModal/close for jsdom, which has neither: ui's ConfirmDialog
 *       (inside DeleteAccountForm) opens one. Import it for its side effect in a jsdom test file.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

const proto = globalThis.HTMLDialogElement?.prototype;
if (proto && typeof proto.showModal !== "function") {
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

export {};
