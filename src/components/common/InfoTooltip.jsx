import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FiInfo } from 'react-icons/fi';

export default function InfoTooltip({ text }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const tooltipRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, arrowLeft: '50%', placement: 'top' });

  const calculate = useCallback(() => {
    const btn = buttonRef.current;
    const tip = tooltipRef.current;
    if (!btn || !tip) return;

    const br = btn.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    const pad = 8; // min distance from viewport edge

    // Decide vertical placement: prefer top, fallback to bottom
    let placement = 'top';
    let top = br.top - tr.height - 8;
    if (top < pad) {
      placement = 'bottom';
      top = br.bottom + 8;
    }

    // Horizontal: center on button, then clamp to viewport
    let left = br.left + br.width / 2 - tr.width / 2;
    const maxLeft = window.innerWidth - tr.width - pad;
    left = Math.max(pad, Math.min(left, maxLeft));

    // Arrow tracks the button center relative to the tooltip
    const arrowLeft = Math.max(12, Math.min(br.left + br.width / 2 - left, tr.width - 12));

    setPos({ top, left, arrowLeft: `${arrowLeft}px`, placement });
  }, []);

  useEffect(() => {
    if (!open) return;
    // Calculate after the tooltip renders
    requestAnimationFrame(calculate);

    const handleClick = (e) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target) &&
        tooltipRef.current && !tooltipRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const handleScroll = () => setOpen(false);
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', calculate);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', calculate);
    };
  }, [open, calculate]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="ml-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none inline-flex flex-shrink-0"
        aria-label="Información"
      >
        <FiInfo className="w-4 h-4" />
      </button>
      {open && createPortal(
        <div
          ref={tooltipRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-64 sm:w-72 p-3 text-xs leading-relaxed text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600"
        >
          {text}
          {/* Arrow */}
          <div
            className="absolute"
            style={{
              left: pos.arrowLeft,
              transform: 'translateX(-50%)',
              ...(pos.placement === 'top'
                ? { top: '100%', marginTop: '-1px' }
                : { bottom: '100%', marginBottom: '-1px' }),
            }}
          >
            <div
              className="w-2.5 h-2.5 bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600"
              style={{
                transform: pos.placement === 'top'
                  ? 'rotate(45deg) translateY(-50%)'
                  : 'rotate(45deg) translateY(50%)',
                borderRight: pos.placement === 'top' ? '1px solid' : 'none',
                borderBottom: pos.placement === 'top' ? '1px solid' : 'none',
                borderLeft: pos.placement === 'bottom' ? '1px solid' : 'none',
                borderTop: pos.placement === 'bottom' ? '1px solid' : 'none',
                borderColor: 'inherit',
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
