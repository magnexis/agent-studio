from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
BASE_URL = "http://127.0.0.1:4174/workspaces/runtime/previews"
SCREENSHOTS = ROOT / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)


def inspect(page):
    return page.evaluate(
        """
        () => ({
          width: innerWidth,
          bodyWidth: document.body.scrollWidth,
          overflow: document.body.scrollWidth > innerWidth,
          messages: document.querySelectorAll('.message').length,
          contextVisible: getComputedStyle(document.querySelector('#contextRail')).visibility === 'visible'
        })
        """
    )


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    errors = []

    sidebar = browser.new_page(viewport={"width": 320, "height": 900}, device_scale_factor=1)
    sidebar.on("pageerror", lambda error: errors.append(str(error)))
    sidebar.goto(f"{BASE_URL}/magnexis-vscode-sidebar.html", wait_until="networkidle")
    assert sidebar.locator("h1").inner_text() == "Agent Lab"
    sidebar.screenshot(path=SCREENSHOTS / "06-vscode-compact-sidebar.png", full_page=True)
    print("sidebar", inspect(sidebar))
    sidebar.get_by_role("button", name="More actions").click()
    assert sidebar.locator("#headerMenu").is_visible()
    sidebar.screenshot(path=SCREENSHOTS / "19-vscode-action-menu.png", full_page=True)
    sidebar.get_by_role("button", name="More actions").click()
    sidebar.get_by_role("textbox", name="Message coding assistant").fill("/")
    assert sidebar.locator(".slash-item").count() >= 8
    sidebar.screenshot(path=SCREENSHOTS / "14-vscode-slash-command-menu.png", full_page=True)
    sidebar.get_by_role("textbox", name="Message coding assistant").press("ArrowDown")
    sidebar.get_by_role("textbox", name="Message coding assistant").press("Enter")
    assert sidebar.get_by_role("textbox", name="Message coding assistant").input_value().startswith("/")
    sidebar.get_by_role("textbox", name="Message coding assistant").fill("")
    sidebar.get_by_role("button", name="Context", exact=True).click()
    sidebar.wait_for_timeout(220)
    assert sidebar.locator("#contextRail").is_visible()
    sidebar.screenshot(path=SCREENSHOTS / "07-vscode-context-drawer.png", full_page=True)
    sidebar.locator("#closeContext").click()
    sidebar.get_by_role("button", name="Browse threads").click()
    sidebar.wait_for_timeout(220)
    assert sidebar.locator("#threadRail").is_visible()
    assert sidebar.locator(".thread-item").count() == 4
    sidebar.screenshot(path=SCREENSHOTS / "16-vscode-thread-drawer.png", full_page=True)
    sidebar.locator("#threadSearch").fill("indexer")
    assert sidebar.locator(".thread-item:visible").count() == 1
    sidebar.locator(".thread-item:visible").click()
    assert sidebar.evaluate("window.__magnexisMessages.at(-1).type") == "switchThread"
    sidebar.wait_for_timeout(220)
    assert not sidebar.locator("#threadRail").is_visible()
    sidebar.locator("#providerChip").click()
    assert sidebar.locator("#providerPicker").is_visible()
    assert sidebar.locator(".provider-choice-grid [data-provider]").count() == 19
    sidebar.locator("#providerSearch").fill("OpenRouter")
    assert sidebar.locator(".provider-choice-grid [data-provider]:visible").count() == 1
    sidebar.locator("#providerSearch").fill("")
    sidebar.locator('[data-provider-filter="local"]').click()
    assert sidebar.locator(".provider-choice-grid [data-provider]:visible").count() == 3
    sidebar.locator('[data-provider-filter="all"]').click()
    sidebar.locator('[data-provider="openrouter"]').click()
    assert sidebar.locator("#modelInput").input_value() == "openrouter/auto"
    assert sidebar.locator("#modelInput option").count() >= 5
    sidebar.locator("#refreshModels").click()
    assert sidebar.evaluate("window.__magnexisMessages.at(-1).type") == "listModels"
    sidebar.evaluate("window.dispatchEvent(new MessageEvent('message', { data: { type: 'providerModels', provider: 'openrouter', ok: true, detail: 'Reachable', models: ['anthropic/claude-sonnet', 'openai/gpt-latest'] } }))")
    assert sidebar.locator('#modelInput option[value="anthropic/claude-sonnet"]').count() == 1
    assert "reported by the provider" in sidebar.locator("#modelSource").inner_text()
    sidebar.screenshot(path=SCREENSHOTS / "18-vscode-provider-picker.png", full_page=True)
    sidebar.locator("#saveProviderPicker").click()
    assert sidebar.evaluate("window.__magnexisMessages.at(-1).type") == "updateSettings"
    sidebar.get_by_role("button", name="Current file").click()
    assert sidebar.locator("#contextMenu").is_visible()
    sidebar.locator('[data-context-action="file"]').click()
    assert sidebar.evaluate("window.__magnexisMessages.at(-1).type") == "attachFile"

    split = browser.new_page(viewport={"width": 560, "height": 900}, device_scale_factor=1)
    split.on("pageerror", lambda error: errors.append(str(error)))
    split.goto(f"{BASE_URL}/magnexis-vscode-panel.html", wait_until="networkidle")
    split.screenshot(path=SCREENSHOTS / "08-vscode-split-panel.png", full_page=True)
    print("split", inspect(split))
    split.get_by_role("textbox", name="Message coding assistant").fill("Plan a safe provider fallback change.")
    split.get_by_role("button", name="Send").click()
    assert split.evaluate("window.__magnexisMessages.at(-1).type") == "sendPrompt"

    wide = browser.new_page(viewport={"width": 1040, "height": 900}, device_scale_factor=1)
    wide.on("pageerror", lambda error: errors.append(str(error)))
    wide.goto(f"{BASE_URL}/magnexis-vscode-panel.html", wait_until="networkidle")
    wide.screenshot(path=SCREENSHOTS / "09-vscode-wide-panel.png", full_page=True)
    wide.screenshot(path=SCREENSHOTS / "11-vscode-change-proposal.png", full_page=True)
    wide.screenshot(path=SCREENSHOTS / "13-vscode-agent-activity.png", full_page=True)
    assert wide.locator(".activity-card.completed").count() == 1
    wide.locator(".proposal-file").first.click()
    assert wide.evaluate("window.__magnexisMessages.at(-1).type") == "previewEdit"
    print("wide", inspect(wide))

    print("browserErrors", errors)
    assert not errors
    browser.close()
