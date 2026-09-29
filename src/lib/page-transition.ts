/**
 * astro:page-load 只保证目标页脚本已执行，并不等待原生 View Transition 播完。
 * Astro 在 finished 后移除 data-astro-transition；以此作为装饰收尾和首次几何
 * 测量的边界，避免在快照采集期间改名或强制布局。下一次导航开始就取消旧任务，
 * 防止连续点击时旧页的收尾误操作新页。此边界同样适用于 Astro 的 fallback。
 */
export function afterPageTransition(callback: () => void): () => void {
  let frame = 0;
  let disposed = false;
  let observer: MutationObserver | undefined;
  const cancel = () => {
    disposed = true;
    observer?.disconnect();
    cancelAnimationFrame(frame);
    document.removeEventListener('astro:before-preparation', cancel);
  };
  const schedule = () => {
    if (disposed || document.documentElement.hasAttribute('data-astro-transition')) return;
    observer?.disconnect();
    frame = requestAnimationFrame(() => {
      cancel();
      callback();
    });
  };
  document.addEventListener('astro:before-preparation', cancel, { once: true });
  if (document.documentElement.hasAttribute('data-astro-transition')) {
    observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-astro-transition'] });
  }
  schedule();
  return cancel;
}
