from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
BASE_URL = "http://127.0.0.1:4175/workspaces/runtime/previews"
SCREENSHOTS = ROOT / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)


def inspect(page):
    return page.evaluate(
        """
        () => ({
          width: innerWidth,
          bodyWidth: document.body.scrollWidth,
          overflow: document.body.scrollWidth > innerWidth,
          guideCards: document.querySelectorAll('.guide-card').length,
          screenshots: document.querySelectorAll('.shot-card').length
        })
        """
    )


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    errors = []

    page = browser.new_page(viewport={"width": 1440, "height": 1080}, device_scale_factor=1)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(f"{BASE_URL}/magnexis-web-dashboard.html", wait_until="networkidle")
    page.screenshot(path=SCREENSHOTS / "21-web-dashboard-home.png", full_page=True)
    print("web-home", inspect(page))

    page.get_by_role("textbox", name="Message Magnexis workspace").fill(
        "Summarize the exact local setup path for this project."
    )
    page.screenshot(path=SCREENSHOTS / "22-web-dashboard-composer.png", full_page=True)

    print("browserErrors", errors)
    assert not errors
    browser.close()
