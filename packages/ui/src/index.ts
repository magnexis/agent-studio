export const magnexisTheme = {
  background: "#070707",
  panel: "#101010",
  panelRaised: "#151515",
  border: "rgba(255, 255, 255, 0.10)",
  borderStrong: "rgba(255, 255, 255, 0.16)",
  text: "#f3f4f6",
  muted: "#a0a7b1",
  faint: "#737b86",
  button: "rgba(255, 255, 255, 0.82)",
  buttonText: "#050505"
};

export const magnexisInteractiveTokensCss = `
  --interactive-radius-sm: 8px;
  --interactive-radius-md: 10px;
  --interactive-radius-lg: 14px;
  --interactive-radius-pill: 999px;
  --interactive-border-default: rgba(255, 255, 255, 0.10);
  --interactive-border-strong: rgba(255, 255, 255, 0.16);
  --interactive-border-selected: rgba(255, 255, 255, 0.24);
  --interactive-bg-default: rgba(255, 255, 255, 0.03);
  --interactive-bg-hover: rgba(255, 255, 255, 0.055);
  --interactive-bg-pressed: rgba(255, 255, 255, 0.075);
  --interactive-bg-selected: rgba(255, 255, 255, 0.065);
  --interactive-bg-elevated: rgba(255, 255, 255, 0.025);
  --interactive-fg-default: var(--text, var(--foreground, #f3f4f6));
  --interactive-fg-muted: var(--muted, #a0a7b1);
  --interactive-fg-faint: var(--faint, #737b86);
  --interactive-focus-ring: rgba(255, 255, 255, 0.22);
  --interactive-primary-bg: rgba(255, 255, 255, 0.84);
  --interactive-primary-bg-hover: rgba(255, 255, 255, 0.78);
  --interactive-primary-bg-pressed: rgba(255, 255, 255, 0.72);
  --interactive-primary-fg: #050505;
  --interactive-quiet-bg: transparent;
  --interactive-quiet-border: transparent;
  --interactive-quiet-fg: var(--muted, #a0a7b1);
  --interactive-success-bg: rgba(88, 200, 137, 0.12);
  --interactive-success-border: rgba(88, 200, 137, 0.34);
  --interactive-success-fg: #9fe1b8;
  --interactive-danger-bg: rgba(239, 112, 112, 0.10);
  --interactive-danger-border: rgba(239, 112, 112, 0.28);
  --interactive-danger-fg: #f0a0a0;
  --interactive-shadow-selected: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
  --interactive-transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease, box-shadow 140ms ease, transform 140ms ease, opacity 140ms ease;
`;

export const magnexisInteractiveComponentsCss = `
  .ui-button,
  .button,
  .ghost-button,
  .primary-button {
    min-height: 30px;
    padding: 6px 10px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid var(--interactive-border-default);
    border-radius: var(--interactive-radius-sm);
    background: var(--interactive-bg-default);
    color: var(--interactive-fg-default);
    font: inherit;
    font-weight: 560;
    letter-spacing: 0;
    transition: var(--interactive-transition);
  }
  .ui-button:hover,
  .button:hover,
  .ghost-button:hover,
  .primary-button:hover {
    border-color: var(--interactive-border-strong);
    background: var(--interactive-bg-hover);
    color: var(--interactive-fg-default);
  }
  .ui-button:active,
  .button:active,
  .ghost-button:active,
  .primary-button:active {
    background: var(--interactive-bg-pressed);
    transform: translateY(1px);
  }
  .ui-button:focus-visible,
  .button:focus-visible,
  .ghost-button:focus-visible,
  .primary-button:focus-visible,
  .ui-icon-button:focus-visible,
  .ui-select-button:focus-visible,
  .ui-nav-button:focus-visible,
  .ui-selectable-card:focus-visible {
    outline: 1px solid var(--interactive-focus-ring);
    outline-offset: 1px;
  }
  .ui-button.is-primary,
  .button.primary,
  .primary-button,
  .send-button,
  .chat-send-button {
    border-color: rgba(255, 255, 255, 0.14);
    background: var(--interactive-primary-bg);
    color: var(--interactive-primary-fg);
  }
  .ui-button.is-primary:hover,
  .button.primary:hover,
  .primary-button:hover,
  .send-button:hover,
  .chat-send-button:hover {
    background: var(--interactive-primary-bg-hover);
    color: var(--interactive-primary-fg);
  }
  .ui-button.is-primary:active,
  .button.primary:active,
  .primary-button:active,
  .send-button:active,
  .chat-send-button:active {
    background: var(--interactive-primary-bg-pressed);
  }
  .ui-button.is-secondary,
  .button.secondary {
    background: var(--interactive-bg-default);
    color: var(--interactive-fg-default);
  }
  .ui-button.is-quiet,
  .button.quiet,
  .ghost-button {
    border-color: var(--interactive-quiet-border);
    background: var(--interactive-quiet-bg);
    color: var(--interactive-quiet-fg);
  }
  .ui-button.is-quiet:hover,
  .button.quiet:hover,
  .ghost-button:hover {
    border-color: var(--interactive-border-default);
    background: var(--interactive-bg-hover);
    color: var(--interactive-fg-default);
  }
  .ui-button.is-success,
  .button.success {
    border-color: var(--interactive-success-border);
    background: var(--interactive-success-bg);
    color: var(--interactive-success-fg);
  }
  .ui-button.is-danger,
  .button.danger {
    border-color: var(--interactive-danger-border);
    background: var(--interactive-danger-bg);
    color: var(--interactive-danger-fg);
  }
  .ui-button.is-pill,
  .ghost-button,
  .primary-button,
  .send-button,
  .chat-send-button {
    border-radius: var(--interactive-radius-pill);
  }
  .ui-button.is-icon,
  .ui-icon-button,
  .send-button,
  .chat-send-button,
  .web-composer-icon {
    width: 28px;
    min-width: 28px;
    min-height: 28px;
    padding: 0;
  }
  .ui-icon-button,
  .ui-select-button,
  .composer-icon-button,
  .composer-select-button,
  .web-composer-select,
  .web-composer-icon {
    border: 1px solid transparent;
    border-radius: var(--interactive-radius-pill);
    background: transparent;
    color: color-mix(in srgb, var(--interactive-fg-default) 80%, var(--interactive-fg-muted));
    transition: var(--interactive-transition);
  }
  .ui-icon-button:hover,
  .ui-select-button:hover,
  .composer-icon-button:hover,
  .composer-select-button:hover,
  .web-composer-select:hover,
  .web-composer-icon:hover {
    background: var(--interactive-bg-hover);
    color: var(--interactive-fg-default);
  }
  .ui-select-button,
  .composer-select-button,
  .web-composer-select {
    min-width: 0;
    max-width: 220px;
    padding: 0 10px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
  }
  .ui-nav-button,
  .rail-button,
  .rail-link,
  .sidebar-thread,
  .thread-item,
  .settings-link {
    transition: var(--interactive-transition);
  }
  .ui-nav-button:hover,
  .rail-button:hover,
  .rail-link:hover,
  .sidebar-thread:hover,
  .thread-item:hover,
  .settings-link:hover {
    border-color: var(--interactive-border-default);
    background: var(--interactive-bg-hover);
    color: var(--interactive-fg-default);
  }
  .ui-nav-button.active,
  .rail-button.active,
  .rail-link.active,
  .sidebar-thread.active,
  .thread-item.active,
  .settings-link.active {
    border-color: var(--interactive-border-selected);
    background: var(--interactive-bg-selected);
    color: var(--interactive-fg-default);
    box-shadow: var(--interactive-shadow-selected);
  }
  .ui-selectable-card,
  .provider-card,
  .guide-card,
  .tool-card {
    transition: var(--interactive-transition);
  }
  .ui-selectable-card:hover,
  .provider-card:hover,
  .guide-card:hover,
  .tool-card:hover {
    border-color: var(--interactive-border-strong);
    background: var(--interactive-bg-hover);
  }
  .ui-selectable-card.selected,
  .provider-card.selected,
  .guide-card.current,
  .tool-card.lifted {
    border-color: var(--interactive-border-selected);
    background: var(--interactive-bg-selected);
    box-shadow: var(--interactive-shadow-selected);
  }
`;
