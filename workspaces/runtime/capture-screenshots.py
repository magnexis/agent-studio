"""Capture desktop-preview screenshots with a self-contained server.

This is a robust variant of ``capture-desktop-preview.py`` that bundles its
own HTTP server so it can run from any working directory without a separate
``python -m http.server`` process. It regenerates the preview HTML first, then
walks the documented capture flow and writes PNGs into ``/screenshots``.
"""

from __future__ import annotations

import functools
import http.server
import socketserver
import subprocess
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
PREVIEWS = ROOT / "workspaces" / "runtime" / "previews"
SCREENSHOTS = ROOT / "screenshots"
ENTRY = PREVIEWS / "magnexis-desktop-provider-workbench.html"
URL = "http://127.0.0.1:4173/magnexis-desktop-provider-workbench.html"


def regenerate_preview() -> None:
    """Re-render the preview HTML from the current TypeScript source."""
    renderer = ROOT / "workspaces" / "runtime" / "render-desktop-preview.cjs"
    subprocess.run(["node", str(renderer)], cwd=str(ROOT), check=True)


@functools.lru_cache(maxsize=1)
def _suffix_for(path: Path) -> str:
    return ".html" if path.suffix == ".html" else ""


def make_handler(root: Path) -> type[http.server.SimpleHTTPRequestHandler]:
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):  # type: ignore[no-untyped-def]
            super().__init__(*args, directory=str(root), **kwargs)

        def log_message(self, *args):  # silence default stderr spam  # type: ignore[no-untyped-def]
            return

    return Handler


class Server(socketserver.TCPServer):
    allow_reuse_address = True


def start_server(root: Path) -> tuple[Server, threading.Thread]:
    server = Server(("127.0.0.1", 4173), make_handler(root))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread


def inspect_layout(page) -> dict:
    return page.evaluate(
        """
        () => ({
          bodyWidth: document.body.scrollWidth,
          viewportWidth: window.innerWidth,
          horizontalOverflow: document.body.scrollWidth > window.innerWidth,
          providerCards: document.querySelectorAll('.provider-card').length,
          railButtons: document.querySelectorAll('.rail-button').length,
          inspectorVisible: getComputedStyle(document.querySelector('.inspector')).display !== 'none'
        })
        """
    )


def main() -> int:
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)

    print(">> Regenerating preview HTML")
    regenerate_preview()
    if not ENTRY.exists():
        print(f"!! Expected preview at {ENTRY}", file=sys.stderr)
        return 1

    server, thread = start_server(PREVIEWS)
    browser_errors: list[str] = []

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
            page.on("pageerror", lambda error: browser_errors.append(str(error)))

            page.goto(URL, wait_until="networkidle")
            page.screenshot(path=str(SCREENSHOTS / "01-provider-management.png"), full_page=True)
            print("01 providers", inspect_layout(page))

            page.get_by_role("button", name="Add provider").click()
            page.screenshot(path=str(SCREENSHOTS / "02-provider-setup.png"), full_page=True)
            assert page.locator("#providerModal").is_visible()
            page.locator("#providerType").select_option(label="Ollama")
            assert page.locator("#providerEndpoint").input_value() == "http://127.0.0.1:11434/v1"
            page.get_by_role("button", name="Close provider setup").click()

            page.get_by_role("button", name="Chat", exact=True).click()
            page.screenshot(path=str(SCREENSHOTS / "03-project-chat.png"), full_page=True)
            page.get_by_role("textbox", name="Message coding assistant").fill(
                "Summarize the safest patch before changing any files."
            )
            page.get_by_role("button", name="Send").click()
            assert page.get_by_text(
                "Summarize the safest patch before changing any files."
            ).is_visible()
            page.wait_for_timeout(2300)

            page.get_by_role("button", name="Agent tasks", exact=True).click()
            page.get_by_role("button", name="Running", exact=True).click()
            assert page.locator('[data-panel="agents"] .task-row:visible').count() == 1
            page.get_by_role("button", name="All runs", exact=True).click()

            page.get_by_role("button", name="Settings", exact=True).click()
            page.locator(".toggle").first.click()
            assert page.locator(".toggle").first.get_attribute("aria-checked") == "true"

            agent_page = browser.new_page(
                viewport={"width": 1440, "height": 1000}, device_scale_factor=1
            )
            agent_page.on("pageerror", lambda error: browser_errors.append(str(error)))
            agent_page.goto(f"{URL}#agents", wait_until="networkidle")
            agent_page.screenshot(path=str(SCREENSHOTS / "04-agent-tasks.png"), full_page=True)

            settings_page = browser.new_page(
                viewport={"width": 1440, "height": 1000}, device_scale_factor=1
            )
            settings_page.on("pageerror", lambda error: browser_errors.append(str(error)))
            settings_page.goto(f"{URL}#settings", wait_until="networkidle")
            settings_page.screenshot(
                path=str(SCREENSHOTS / "05-settings-and-routing.png"), full_page=True
            )

            tools_page = browser.new_page(
                viewport={"width": 1440, "height": 1000}, device_scale_factor=1
            )
            tools_page.on("pageerror", lambda error: browser_errors.append(str(error)))
            tools_page.goto(f"{URL}#tools", wait_until="networkidle")
            assert tools_page.locator(".tool-card:visible").count() == 5
            tools_page.screenshot(
                path=str(SCREENSHOTS / "06-tools-and-capabilities.png"), full_page=True
            )

            print(">> browserErrors", browser_errors)
            assert not browser_errors, browser_errors
            browser.close()
    finally:
        server.shutdown()
        thread.join(timeout=5)

    captured = sorted(p.name for p in SCREENSHOTS.glob("*.png"))
    print(f">> Captured {len(captured)} screenshots:")
    for name in captured:
        print(f"   - {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
