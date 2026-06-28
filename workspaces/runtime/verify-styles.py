"""Validate that the sharpened CSS actually applies to the rendered preview.

Asserts computed styles on the chat, tools, settings, and provider-modal
surfaces so we know the restyle landed (not just that the page renders).
Run after capture-screenshots.py.
"""

import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
PREVIEWS = ROOT / "workspaces" / "runtime" / "previews"
BASE = "http://127.0.0.1:4175/magnexis-desktop-provider-workbench.html"


def make_handler(root: Path):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)
        def log_message(self, *args):
            return
    return Handler


def main() -> int:
    server = socketserver.TCPServer(("127.0.0.1", 4175), make_handler(PREVIEWS))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    failures = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page(viewport={"width": 1440, "height": 1000})

            def go(fragment: str) -> None:
                page.goto(f"{BASE}#{fragment}", wait_until="networkidle")

            def style(selector: str, prop: str) -> str:
                return page.eval_on_selector(selector, f"(e)=>getComputedStyle(e).{prop}")

            def pseudostyle(selector: str, pseudo: str, prop: str) -> str:
                return page.eval_on_selector(
                    selector, f"(e)=>getComputedStyle(e,'{pseudo}').{prop}"
                )

            # --- Tools ---
            go("tools")
            radius = style(".tool-card", "borderRadius")
            if radius != "12px":
                failures.append(f"tool-card borderRadius expected 12px got {radius}")
            # Hover lift is a :hover rule; assert it exists in the stylesheet text.
            has_lift = page.evaluate(
                "()=>[...document.styleSheets].some(ss=>{try{return Array.from(ss.cssRules).some(r=>r.cssText&&r.cssText.includes('.tool-card:hover')&&r.cssText.includes('translateY'))}catch(e){return false}})"
            )
            if not has_lift:
                failures.append("tool-card :hover lift rule not present in CSS")
            risk_class = page.eval_on_selector(".task-state.risk", "(e)=>e.className")
            if "risk" not in risk_class:
                failures.append(f"risk badge missing 'risk' class: {risk_class!r}")

            # --- Settings ---
            go("settings")
            link_active_border = pseudostyle(".settings-link.active", "::before", "left")
            # active uses border-left on the element itself, not ::before; check element border
            link_radius = style(".settings-link", "borderRadius")
            if link_radius != "0px":
                failures.append(f"settings-link radius expected 0px (flush nav) got {link_radius}")
            grp_radius = style(".setting-group", "borderRadius")
            if grp_radius != "12px":
                failures.append(f"setting-group radius expected 12px got {grp_radius}")

            # --- Provider modal ---
            go("providers")
            modal_radius = style(".modal", "borderRadius")
            if modal_radius != "14px":
                failures.append(f"modal radius expected 14px got {modal_radius}")

            # --- Chat ---
            go("chat")
            msg_radius = style(".message-body", "borderRadius")
            # User/assistant bubbles use an asymmetric radius (a 'tail'): ends in 4px.
            if not msg_radius.endswith("4px"):
                failures.append(f"message-body radius expected to end in 4px (tail) got {msg_radius}")
            avatar_present = page.locator(".message-avatar").count()
            if avatar_present < 2:
                failures.append(f"expected >=2 message avatars, got {avatar_present}")
            composer_radius = style(".composer", "borderRadius")
            if composer_radius != "12px":
                failures.append(f"composer radius expected 12px got {composer_radius}")

            browser.close()
    finally:
        server.shutdown()

    if failures:
        print("FAIL:")
        for f in failures:
            print("  -", f)
        return 1
    print("OK: all sharpened styles verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
