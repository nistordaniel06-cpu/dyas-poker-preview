// The gallery can freeze presentation time independently of the game clock.
const pending = new Set();
let paused = false;
function arm(job) {
  job.start = performance.now();
  job.id = setTimeout(() => { pending.delete(job); job.fn(); }, job.left);
}
export function delay(fn, ms) {
  const job = {fn, left: ms};
  pending.add(job);
  if (!paused) arm(job);
  return job;
}
export function cancel(job) {
  clearTimeout(job.id);
  pending.delete(job);
}
export function freeze(value) {
  if (paused === value) return;
  paused = value;
  for (const job of pending) {
    if (!value) { arm(job); continue; }
    clearTimeout(job.id);
    job.left = Math.max(0, job.left - (performance.now() - job.start));
  }
  for (const a of document.getAnimations()) value ? a.pause() : a.play();
  for (const svg of document.querySelectorAll('.v-art')) value ? svg.pauseAnimations() : svg.unpauseAnimations();
}
