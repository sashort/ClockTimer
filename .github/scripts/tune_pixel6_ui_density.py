from pathlib import Path

path = Path('app.css')
css = path.read_text(encoding='utf-8')
marker = '/* pixel6-reference-density-v1 */'
if marker in css:
    raise SystemExit('Pixel 6 density block already exists')

css += r'''

/* pixel6-reference-density-v1
   Main-screen proportions tuned against the legacy Pixel 6 reference.
   Structural row heights intentionally remain unchanged; the reference
   matches them closely. This block reduces the visual weight of type and
   icons and restores a little breathing room inside the controls. */
@media (max-width: 520px) {
    .hamburger-button {
        font-size: clamp(20px, 5.3vw, 22px);
    }

    .scope-toggle {
        padding-inline: clamp(8px, 3vw, 12px);
        font-size: clamp(20px, 5.8vw, 24px);
    }

    .summary-cell {
        padding-inline: clamp(4px, 1.6vw, 7px);
    }

    .summary-label {
        font-size: clamp(13px, 3.9vw, 16px);
        line-height: 1.08;
    }

    .summary-cell strong {
        font-size: clamp(24px, 6.8vw, 28px);
    }

    .percent-summary {
        gap: clamp(8px, 2.5vw, 11px);
        font-size: clamp(40px, 10.7vw, 44px);
    }

    .new-trip-button {
        padding-inline: clamp(10px, 3vw, 14px);
        font-size: clamp(36px, 10vw, 42px);
    }

    .trip-action-button {
        padding-inline: clamp(8px, 2.6vw, 12px);
        font-size: clamp(28px, 8.3vw, 34px);
    }

    .independent-timer-value {
        padding-inline: clamp(8px, 2.5vw, 12px);
        font-size: clamp(20px, 5.3vw, 22px);
    }

    .independent-timer-controls button {
        padding-inline: clamp(5px, 2vw, 8px);
        font-size: clamp(24px, 6.8vw, 28px);
    }

    .stop-icon {
        width: clamp(24px, 6.5vw, 27px);
        height: clamp(24px, 6.5vw, 27px);
        border-width: 2px;
    }

    clock-timer {
        --clock-timer-time-font-size: clamp(40px, 11vw, 46px);
        --clock-timer-hour-font-size: clamp(20px, 5.5vw, 23px);
    }

    .trip-log-button {
        padding-inline: clamp(10px, 3vw, 14px);
        font-size: clamp(36px, 9.7vw, 40px);
    }
}
'''

path.write_text(css, encoding='utf-8')
