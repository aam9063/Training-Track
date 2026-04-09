import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';

const ANIMATION_CONFIG = { SMOOTH_TAU: 0.25, MIN_COPIES: 2, COPY_HEADROOM: 2 };
const toCssLength = value => (typeof value === 'number' ? `${value}px` : (value ?? undefined));
const cx = (...parts) => parts.filter(Boolean).join(' ');

const useResizeObserver = (callback, elements, dependencies) => {
  useEffect(() => {
    if (!window.ResizeObserver) {
      const handleResize = () => callback();
      window.addEventListener('resize', handleResize);
      callback();
      return () => window.removeEventListener('resize', handleResize);
    }
    const observers = elements.map(ref => {
      if (!ref.current) return null;
      const observer = new ResizeObserver(callback);
      observer.observe(ref.current);
      return observer;
    });
    callback();
    return () => { observers.forEach(o => o?.disconnect()); };
  }, [callback, elements, dependencies]);
};

const useImageLoader = (seqRef, onLoad, dependencies) => {
  useEffect(() => {
    const images = seqRef.current?.querySelectorAll('img') ?? [];
    if (images.length === 0) { onLoad(); return; }
    let remaining = images.length;
    const done = () => { remaining -= 1; if (remaining === 0) onLoad(); };
    images.forEach(img => {
      if (img.complete) done();
      else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
    });
    return () => { images.forEach(img => { img.removeEventListener('load', done); img.removeEventListener('error', done); }); };
  }, [onLoad, seqRef, dependencies]);
};

const useAnimationLoop = (trackRef, targetVelocity, seqWidth, seqHeight, isHovered, hoverSpeed, isVertical) => {
  const rafRef = useRef(null);
  const lastTs = useRef(null);
  const offset = useRef(0);
  const vel = useRef(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const seqSize = isVertical ? seqHeight : seqWidth;
    if (seqSize > 0) {
      offset.current = ((offset.current % seqSize) + seqSize) % seqSize;
      track.style.transform = isVertical ? `translate3d(0,${-offset.current}px,0)` : `translate3d(${-offset.current}px,0,0)`;
    }
    if (prefersReduced) { track.style.transform = 'translate3d(0,0,0)'; return () => { lastTs.current = null; }; }

    const animate = ts => {
      if (lastTs.current === null) lastTs.current = ts;
      const dt = Math.max(0, ts - lastTs.current) / 1000;
      lastTs.current = ts;
      const target = isHovered && hoverSpeed !== undefined ? hoverSpeed : targetVelocity;
      vel.current += (target - vel.current) * (1 - Math.exp(-dt / ANIMATION_CONFIG.SMOOTH_TAU));
      if (seqSize > 0) {
        let next = offset.current + vel.current * dt;
        next = ((next % seqSize) + seqSize) % seqSize;
        offset.current = next;
        track.style.transform = isVertical ? `translate3d(0,${-offset.current}px,0)` : `translate3d(${-offset.current}px,0,0)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); rafRef.current = null; lastTs.current = null; };
  }, [targetVelocity, seqWidth, seqHeight, isHovered, hoverSpeed, isVertical, trackRef]);
};

const LogoLoop = memo(({
  logos, speed = 120, direction = 'left', width = '100%', logoHeight = 28, gap = 32,
  pauseOnHover, hoverSpeed, fadeOut = false, fadeOutColor, scaleOnHover = false,
  renderItem, ariaLabel = 'Partner logos', className, style,
}) => {
  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const seqRef = useRef(null);
  const [seqWidth, setSeqWidth] = useState(0);
  const [seqHeight, setSeqHeight] = useState(0);
  const [copyCount, setCopyCount] = useState(ANIMATION_CONFIG.MIN_COPIES);
  const [isHovered, setIsHovered] = useState(false);

  const effectiveHoverSpeed = useMemo(() => {
    if (hoverSpeed !== undefined) return hoverSpeed;
    if (pauseOnHover === true) return 0;
    return pauseOnHover === false ? undefined : 0;
  }, [hoverSpeed, pauseOnHover]);

  const isVertical = direction === 'up' || direction === 'down';
  const targetVelocity = useMemo(() => {
    const mag = Math.abs(speed);
    const dir = isVertical ? (direction === 'up' ? 1 : -1) : (direction === 'left' ? 1 : -1);
    return mag * dir * (speed < 0 ? -1 : 1);
  }, [speed, direction, isVertical]);

  const updateDimensions = useCallback(() => {
    const cw = containerRef.current?.clientWidth ?? 0;
    const rect = seqRef.current?.getBoundingClientRect?.();
    const sw = rect?.width ?? 0;
    const sh = rect?.height ?? 0;
    if (isVertical) {
      const ph = containerRef.current?.parentElement?.clientHeight ?? 0;
      if (containerRef.current && ph > 0) containerRef.current.style.height = `${Math.ceil(ph)}px`;
      if (sh > 0) { setSeqHeight(Math.ceil(sh)); setCopyCount(Math.max(ANIMATION_CONFIG.MIN_COPIES, Math.ceil((containerRef.current?.clientHeight ?? sh) / sh) + ANIMATION_CONFIG.COPY_HEADROOM)); }
    } else if (sw > 0) { setSeqWidth(Math.ceil(sw)); setCopyCount(Math.max(ANIMATION_CONFIG.MIN_COPIES, Math.ceil(cw / sw) + ANIMATION_CONFIG.COPY_HEADROOM)); }
  }, [isVertical]);

  useResizeObserver(updateDimensions, [containerRef, seqRef], [logos, gap, logoHeight, isVertical]);
  useImageLoader(seqRef, updateDimensions, [logos, gap, logoHeight, isVertical]);
  useAnimationLoop(trackRef, targetVelocity, seqWidth, seqHeight, isHovered, effectiveHoverSpeed, isVertical);

  const cssVars = useMemo(() => ({ '--logoloop-gap': `${gap}px`, '--logoloop-logoHeight': `${logoHeight}px`, ...(fadeOutColor && { '--logoloop-fadeColor': fadeOutColor }) }), [gap, logoHeight, fadeOutColor]);
  const rootClasses = useMemo(() => cx('relative group', isVertical ? 'overflow-hidden h-full inline-block' : 'overflow-x-hidden', scaleOnHover && 'py-[calc(var(--logoloop-logoHeight)*0.1)]', className), [isVertical, scaleOnHover, className]);

  const handleEnter = useCallback(() => { if (effectiveHoverSpeed !== undefined) setIsHovered(true); }, [effectiveHoverSpeed]);
  const handleLeave = useCallback(() => { if (effectiveHoverSpeed !== undefined) setIsHovered(false); }, [effectiveHoverSpeed]);

  const renderLogo = useCallback((item, key) => {
    if (renderItem) return <li className={cx('flex-none', isVertical ? 'mb-[var(--logoloop-gap)]' : 'mr-[var(--logoloop-gap)]')} key={key} role="listitem">{renderItem(item, key)}</li>;
    const content = 'node' in item
      ? <span className={cx('inline-flex items-center', scaleOnHover && 'transition-transform duration-300 group-hover/item:scale-120')}>{item.node}</span>
      : <img className={cx('h-[var(--logoloop-logoHeight)] w-auto block object-contain [-webkit-user-drag:none] pointer-events-none', scaleOnHover && 'transition-transform duration-300 group-hover/item:scale-120')} src={item.src} alt={item.alt ?? ''} title={item.title} loading="lazy" decoding="async" draggable={false} />;
    const inner = item.href ? <a className="inline-flex items-center no-underline rounded hover:opacity-80" href={item.href} aria-label={item.alt || item.title || 'logo'} target="_blank" rel="noreferrer noopener">{content}</a> : content;
    return <li className={cx('flex-none', isVertical ? 'mb-[var(--logoloop-gap)]' : 'mr-[var(--logoloop-gap)]', scaleOnHover && 'overflow-visible group/item')} key={key} role="listitem">{inner}</li>;
  }, [isVertical, scaleOnHover, renderItem]);

  const lists = useMemo(() => Array.from({ length: copyCount }, (_, i) => (
    <ul className={cx('flex items-center', isVertical && 'flex-col')} key={`c-${i}`} role="list" aria-hidden={i > 0} ref={i === 0 ? seqRef : undefined}>
      {logos.map((item, j) => renderLogo(item, `${i}-${j}`))}
    </ul>
  )), [copyCount, logos, renderLogo, isVertical]);

  return (
    <div ref={containerRef} className={rootClasses} style={{ width: isVertical ? (toCssLength(width) === '100%' ? undefined : toCssLength(width)) : (toCssLength(width) ?? '100%'), ...cssVars, ...style }} role="region" aria-label={ariaLabel} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {fadeOut && !isVertical && (<>
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[clamp(24px,8%,120px)] bg-[linear-gradient(to_right,var(--logoloop-fadeColor,var(--logoloop-fadeColorAuto,#ffffff))_0%,rgba(0,0,0,0)_100%)] dark:bg-[linear-gradient(to_right,var(--logoloop-fadeColor,var(--logoloop-fadeColorAuto,#0b0b0b))_0%,rgba(0,0,0,0)_100%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[clamp(24px,8%,120px)] bg-[linear-gradient(to_left,var(--logoloop-fadeColor,var(--logoloop-fadeColorAuto,#ffffff))_0%,rgba(0,0,0,0)_100%)] dark:bg-[linear-gradient(to_left,var(--logoloop-fadeColor,var(--logoloop-fadeColorAuto,#0b0b0b))_0%,rgba(0,0,0,0)_100%)]" />
      </>)}
      <div className={cx('flex will-change-transform select-none relative z-0', isVertical ? 'flex-col h-max w-full' : 'flex-row w-max')} ref={trackRef} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
        {lists}
      </div>
    </div>
  );
});

LogoLoop.displayName = 'LogoLoop';
export { LogoLoop };
export default LogoLoop;
