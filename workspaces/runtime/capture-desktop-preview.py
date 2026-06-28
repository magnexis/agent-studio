from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
URL = "http://127.0.0.1:4173/workspaces/runtime/previews/magnexis-desktop-provider-workbench.html"
SCREENSHOTS = ROOT / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)


def inspect_layout(page):
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


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    browser_errors = []
    page.on("pageerror", lambda error: browser_errors.append(str(error)))
    page.goto(URL, wait_until="networkidle")
    page.screenshot(path=SCREENSHOTS / "03-project-chat.png", full_page=True)
    print("chat", inspect_layout(page))
    page.get_by_role("button", name="Providers", exact=True).click()
    page.screenshot(path=SCREENSHOTS / "01-provider-management.png", full_page=True)
    print("providers", inspect_layout(page))
    assert page.locator(".provider-card").count() >= 8
    page.locator("#desktopProviderSearch").fill("DeepSeek")
    assert page.locator(".provider-card:visible").count() == 3
    assert page.locator('[data-provider="deepseek"]:visible').count() == 1
    page.locator("#desktopProviderSearch").fill("")
    page.locator('[data-catalog-filter="local"]').click()
    assert page.locator(".provider-card:visible").count() == 3
    page.locator('[data-catalog-filter="all"]').click()

    page.get_by_role("button", name="Open command palette").click()
    page.screenshot(path=SCREENSHOTS / "15-desktop-command-palette.png", full_page=True)
    page.locator("#commandSearch").fill("review proposed")
    assert page.locator(".command-item:visible").count() == 1
    page.locator("#commandSearch").press("Enter")
    assert page.locator("#stageTitle").inner_text() == "Diff Review"
    page.get_by_role("button", name="Providers", exact=True).click()

    page.get_by_role("button", name="Add provider").click()
    page.screenshot(path=SCREENSHOTS / "02-provider-setup.png", full_page=True)
    assert page.locator("#providerModal").is_visible()
    page.locator("#providerType").select_option(label="Together AI")
    assert page.locator("#providerEndpoint").input_value() == "https://api.together.ai/v1"
    assert page.locator("#providerModel").input_value() == "openai/gpt-oss-20b"
    assert page.locator("#providerModel option").count() >= 4
    page.locator("#refreshProviderModels").click()
    assert "desktop runtime" in page.locator("#providerModelSource").inner_text()
    page.get_by_role("button", name="Close provider setup").click()

    page.get_by_role("button", name="Chat", exact=True).click()
    page.screenshot(path=SCREENSHOTS / "12-desktop-agent-activity.png", full_page=True)
    assert page.locator(".chat-activity .activity-row").count() == 3
    page.locator("#approveChatCommand").click()
    assert page.locator("#chatCommandApproval .task-state.complete").inner_text() == "Approved"
    page.get_by_role("textbox", name="Message coding assistant").fill("Summarize the safest patch before changing any files.")
    page.get_by_role("button", name="Send").click()
    assert page.get_by_text("Summarize the safest patch before changing any files.").is_visible()
    page.wait_for_timeout(2300)
    assert page.locator(".sidebar-thread").count() >= 4
    page.screenshot(path=SCREENSHOTS / "17-desktop-thread-history.png", full_page=True)
    page.locator(".sidebar-thread").nth(1).click()
    assert page.locator("#stageTitle").inner_text() == "Project Chat"

    page.get_by_role("button", name="Agent tasks", exact=True).click()
    page.get_by_role("button", name="Running", exact=True).click()
    assert page.locator('[data-panel="agents"] .task-row:visible').count() == 1
    page.get_by_role("button", name="All runs", exact=True).click()

    page.get_by_role("button", name="Settings", exact=True).click()
    page.locator(".toggle").first.click()
    assert page.locator(".toggle").first.get_attribute("aria-checked") == "true"
    assert page.locator("#limitModel option").count() >= 10
    page.locator("#limitModel").select_option("openai/gpt-5.4")
    assert page.locator("#limitContext").get_attribute("max") == "1050000"

    page.get_by_role("button", name="Model stats", exact=True).click()
    assert page.locator("#statsViewport").is_visible()
    assert page.locator("#statsPreviewFallback").is_visible()
    assert not page.locator(".inspector").is_visible()
    assert page.locator(".stats-portal").is_visible()

    agent_page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    agent_page.on("pageerror", lambda error: browser_errors.append(str(error)))
    agent_page.goto(f"{URL}#agents", wait_until="networkidle")
    agent_page.screenshot(path=SCREENSHOTS / "04-agent-tasks.png", full_page=True)

    settings_page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    settings_page.on("pageerror", lambda error: browser_errors.append(str(error)))
    settings_page.goto(f"{URL}#settings", wait_until="networkidle")
    settings_page.screenshot(path=SCREENSHOTS / "05-settings-and-routing.png", full_page=True)

    diff_page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    diff_page.on("pageerror", lambda error: browser_errors.append(str(error)))
    diff_page.goto(f"{URL}#diffs", wait_until="networkidle")
    diff_page.screenshot(path=SCREENSHOTS / "10-desktop-diff-review.png", full_page=True)
    diff_page.get_by_role("button", name="src/auth/session.ts", exact=False).click()
    assert diff_page.locator("#activeDiffPath").inner_text() == "src/auth/session.ts"

    tools_page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    tools_page.on("pageerror", lambda error: browser_errors.append(str(error)))
    tools_page.goto(f"{URL}#tools", wait_until="networkidle")
    assert tools_page.locator(".tool-card:visible").count() >= 9
    tools_page.locator(".tool-install").first.click()
    assert tools_page.locator(".tool-install, .tool-toggle").first.inner_text() == "Enabled"
    tools_page.screenshot(path=SCREENSHOTS / "06-tools-and-capabilities.png", full_page=True)

    stats_page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    stats_page.on("pageerror", lambda error: browser_errors.append(str(error)))
    stats_page.goto(f"{URL}#stats", wait_until="networkidle")
    assert stats_page.locator("#statsViewport").is_visible()
    assert stats_page.locator("#statsPreviewFallback").is_visible()
    assert not stats_page.locator(".inspector").is_visible()
    stats_page.screenshot(path=SCREENSHOTS / "20-desktop-model-stats.png", full_page=True)

    print("browserErrors", browser_errors)
    assert not browser_errors
    browser.close()
