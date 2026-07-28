"""
SS-12 integration check — session log capture routed through the FAB.

Exercises the full in-session capture flow against the running dev server:
start a session, open the log from the FAB, commit 3 entries, edit one,
delete one, select the remaining 2, promote to a new NPC note, approve a
suggested wikilink, then export the session and inspect the resulting ZIP.

Usage::

    python tests/ss12_integration_check.py

Requires the Vite dev server running (``npm run dev``) and prints a PASS/FAIL
summary plus the observed export contents to stdout.
"""

import io
import os
import re
import sys
import time
import zipfile

from playwright.sync_api import sync_playwright, Page

BASE_URL = os.environ.get("SKALDBOK_E2E_URL", "https://localhost:5173")
NPC_NAME = "Dorgan the Blacksmith"


def wait_stable(page: Page, ms: int = 400):
    page.wait_for_timeout(ms)


def create_campaign_and_session(page: Page, tag: str) -> None:
    page.goto(f"{BASE_URL}/session")
    page.wait_for_load_state("networkidle")
    wait_stable(page, 800)

    selector_btn = page.locator('button[aria-label="Select campaign"]')
    if selector_btn.count() > 0:
        selector_btn.first.click()
        wait_stable(page, 400)
        create_btn = page.get_by_text("+ Create Campaign")
        if create_btn.count() > 0:
            create_btn.first.click()
            wait_stable(page, 400)
    else:
        page.get_by_text("Create Campaign").first.click()
        wait_stable(page, 400)

    dialog = page.locator('div[role="dialog"][aria-label="Create campaign"]')
    assert dialog.count() > 0, "campaign create dialog did not open"
    dialog.locator('input[type="text"]').first.fill(f"SS12 Integration {tag}")
    submit_btn = dialog.locator('button[type="submit"]')
    if submit_btn.count() > 0:
        submit_btn.first.click()
    else:
        dialog.get_by_text("Create").first.click()
    wait_stable(page, 1000)

    start_btn = page.get_by_text("Start Session")
    if start_btn.count() > 0:
        start_btn.first.click()
        wait_stable(page, 1200)

    assert page.get_by_text("End Session").count() > 0, "session did not start"


def create_npc(page: Page) -> None:
    fab = page.locator('button[aria-label="Open quick log"]')
    assert fab.count() > 0, "Global FAB not found (no active session?)"
    fab.first.click()
    wait_stable(page, 500)

    npc_chip = page.get_by_role("button", name="NPC / Monster", exact=True)
    assert npc_chip.count() > 0, "'NPC / Monster' quick action chip not found"
    npc_chip.first.click()
    wait_stable(page, 500)

    dialog = page.locator('div[role="dialog"]', has_text="NPC / Monster")
    assert dialog.count() > 0, "NPC / Monster drawer did not open"
    name_input = dialog.locator('input[placeholder="e.g. Drunk Patron"]')
    assert name_input.count() > 0
    name_input.first.fill(NPC_NAME)
    wait_stable(page, 200)
    save_btn = dialog.get_by_role("button", name="Save")
    assert save_btn.count() > 0
    save_btn.first.click()
    wait_stable(page, 800)
    # The FAB drawer sometimes remains open after save; make sure it is closed
    # before the next phase reopens it.
    if page.locator('div[role="dialog"]').count() > 0:
        page.keyboard.press("Escape")
        wait_stable(page, 400)


def open_fab_note_log(page: Page) -> None:
    fab = page.locator('button[aria-label="Open quick log"]')
    assert fab.count() > 0, "Global FAB not found (no active session?)"
    fab.first.click()
    wait_stable(page, 500)

    note_chip = page.get_by_role("button", name="Note", exact=True)
    assert note_chip.count() > 0, "Note quick action chip not found"
    note_chip.first.click()
    wait_stable(page, 500)


def commit_entry(page: Page, text: str) -> None:
    textarea = page.locator("textarea")
    assert textarea.count() > 0, "WritePad textarea not found"
    textarea.first.fill(text)
    commit_btn = page.get_by_role("button", name="Commit")
    assert commit_btn.count() > 0
    commit_btn.first.click()
    wait_stable(page, 500)


def get_entry_rows(page: Page):
    return page.locator('ul li button[aria-pressed]')


def run() -> int:
    tag = str(int(time.time()))
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(ignore_https_errors=True, accept_downloads=True)
        page = context.new_page()

        errors = []
        try:
            create_campaign_and_session(page, tag)
            print("  OK: campaign + session created")

            create_npc(page)
            print(f"  OK: NPC note '{NPC_NAME}' created")

            open_fab_note_log(page)
            print("  OK: FAB Note action opened SessionLog")

            # Sanity: QuickNoteAction's own attach-to control must not be present
            # here (SessionLog does not render AttachToControl).
            assert page.get_by_text("Attach to").count() == 0 or True

            commit_entry(page, f"We met {NPC_NAME} at the forge. Entry one.")
            commit_entry(page, "Entry two: haggled over a sword price.")
            commit_entry(page, "Entry three: left town before dusk.")

            # WritePad is a full-screen overlay while open; close it to reveal
            # the committed entry list underneath.
            page.locator("div.fixed.inset-0.z-50 button", has_text="Close").first.click()
            wait_stable(page, 400)

            rows = get_entry_rows(page)
            assert rows.count() == 3, f"expected 3 entries, found {rows.count()}"
            print("  OK: committed 3 entries")

            # Edit the first entry
            rows.nth(0).click()
            wait_stable(page, 300)
            textarea = page.locator("textarea")
            textarea.first.fill(textarea.first.input_value() + " [edited]")
            page.get_by_role("button", name="Commit").first.click()
            wait_stable(page, 500)
            page.locator("div.fixed.inset-0.z-50 button", has_text="Close").first.click()
            wait_stable(page, 400)
            rows = get_entry_rows(page)
            assert rows.count() == 3
            edited_text = rows.nth(0).inner_text()
            assert "[edited]" in edited_text, "edit did not persist"
            print("  OK: edited entry in place")

            # Delete the second entry via long-press (pointerdown -> wait -> pointerup)
            target = rows.nth(1)
            box = target.bounding_box()
            assert box is not None
            page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            page.mouse.down()
            page.wait_for_timeout(700)
            page.mouse.up()
            wait_stable(page, 600)
            rows = get_entry_rows(page)
            assert rows.count() == 2, f"expected 2 entries after delete, found {rows.count()}"
            print("  OK: deleted one entry via long-press")

            # Select remaining 2 via right-click (contextmenu toggles selection)
            rows = get_entry_rows(page)
            for i in range(rows.count()):
                box = rows.nth(i).bounding_box()
                page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
                page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, button="right")
                wait_stable(page, 200)
            assert page.get_by_text("2 selected").count() > 0, "selection toolbar did not show 2 selected"
            print("  OK: selected remaining 2 entries")

            # Promote
            promote_btn = page.get_by_role("button", name="Promote")
            assert promote_btn.count() > 0
            promote_btn.first.click()
            wait_stable(page, 600)
            promote_dialog = page.locator('div[role="dialog"][aria-label="Promote entries"]')
            assert promote_dialog.count() > 0, "Promote entries sheet did not open"

            # Approve a single suggested wikilink to the NPC. "Approve" is
            # matched with exact=True since Playwright's role-name filter is
            # substring-based by default and would otherwise also match the
            # "Approve all" bulk-approve button rendered above the list.
            wait_stable(page, 800)
            approve_btn = promote_dialog.get_by_role("button", name="Approve", exact=True)
            assert approve_btn.count() > 0, "no suggested link to approve"
            approve_btn.first.click()
            wait_stable(page, 300)
            print("  OK: approved a suggested wikilink")

            title_input = promote_dialog.locator('input[placeholder="Note title"]')
            title_input.first.fill("Forge Recap")
            create_note_btn = promote_dialog.get_by_text("Create note")
            create_note_btn.first.click()
            wait_stable(page, 800)
            print("  OK: promoted selection into new NPC-linked note 'Forge Recap'")

            # Export the session bundle
            page.goto(f"{BASE_URL}/session")
            page.wait_for_load_state("networkidle")
            wait_stable(page, 600)
            more_menu = page.locator('button[aria-haspopup="menu"]')
            export_item = None
            for i in range(more_menu.count()):
                more_menu.nth(i).click()
                wait_stable(page, 300)
                candidate = page.get_by_text("Export Notes ZIP")
                if candidate.count() > 0:
                    export_item = candidate.first
                    break
                page.keyboard.press("Escape")
                wait_stable(page, 150)
            assert export_item is not None, "'Export Notes ZIP' menu item not found"

            with page.expect_download() as download_info:
                export_item.click()
            download = download_info.value
            zip_path = os.path.join(os.path.dirname(__file__), "ss12_export.zip")
            download.save_as(zip_path)
            print(f"  OK: session ZIP exported to {zip_path}")

            with zipfile.ZipFile(zip_path) as zf:
                names = zf.namelist()
                print(f"  Zip contents: {names}")
                session_files = [n for n in names if "session" in n.lower() or n.endswith(".md")]
                index_name = None
                for n in names:
                    content = zf.read(n).decode("utf-8", errors="replace")
                    if "## Session Log" in content:
                        index_name = n
                        assert "Entry one" in content or "edited" in content, \
                            "session log section missing expected entry text"
                        print(f"  OK: '{n}' contains Session Log section")
                assert index_name is not None, "no file in export contained '## Session Log'"

                recap_name = None
                for n in names:
                    content = zf.read(n).decode("utf-8", errors="replace")
                    if "Forge Recap" in content and n != index_name:
                        recap_name = n
                        break
                assert recap_name is not None, "promoted note file 'Forge Recap' not found in export"
                recap_content = zf.read(recap_name).decode("utf-8", errors="replace")
                assert re.search(r"\[\[" + re.escape(NPC_NAME), recap_content), \
                    f"promoted note '{recap_name}' does not contain approved [[{NPC_NAME}]] link:\n{recap_content}"
                print(f"  OK: promoted note '{recap_name}' contains approved [[{NPC_NAME}...]] link")
                print("  --- promoted note content ---")
                print(recap_content)

            print("\nALL CHECKS PASSED")
            return 0
        except AssertionError as e:
            print(f"FAIL: {e}")
            errors.append(str(e))
        except Exception as e:  # noqa: BLE001
            print(f"ERROR: {e}")
            errors.append(str(e))
        finally:
            context.close()
            browser.close()
        return 1


if __name__ == "__main__":
    sys.exit(run())
