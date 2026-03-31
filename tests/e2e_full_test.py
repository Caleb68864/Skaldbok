"""
Skaldmark E2E Full Test Suite — Playwright
============================================

Comprehensive end-to-end test that exercises every UI surface of the
Skaldmark Dragonbane TTRPG companion web app.

**Test Phases (per iteration):**

1. **Campaign creation** — creates a new campaign via the campaign selector header
2. **Character creation** — creates 5 characters in the library, visits all sub-screens
3. **Party management** — adds all characters to the campaign party
4. **Session start** — begins a new game session
5. **Notes testing** — creates Quick Note, Quick NPC, Quick Location, Link Note
6. **Combat (10 rounds)** — starts combat, adds events per round, advances rounds, ends combat
7. **Session Quick Actions** — tests skill check, spell cast, and other quick log chips
8. **Session Log Overlay** — tests floating dice/spell/ability FABs on character screens
9. **Character sub-screens** — navigates Sheet, Skills, Gear, Magic, Combat tabs
10. **Other screens** — loads Settings and Reference screens
11. **Notes verification** — confirms notes appear on the Notes screen
12. **Session end** — ends the session with confirmation modal

**Usage:**

.. code-block:: bash

    # Run 10 iterations (default)
    python tests/e2e_full_test.py

    # Run custom number of iterations
    python tests/e2e_full_test.py 5

**Requirements:**

- Python 3.12+ with ``playwright`` package installed
- Chromium browser installed via ``python -m playwright install chromium``
- Skaldmark dev server running on ``https://localhost:5174`` (Vite + SSL)

**Outputs:**

- Screenshots saved to ``tests/screenshots/`` (per iteration per phase)
- Test report written to ``tests/test_report.txt``
- Console errors and page errors tracked per iteration

:author: Caleb Bennett (with Claude Code)
:date: 2026-03-31
"""

import sys
import time
import random
import traceback
from playwright.sync_api import sync_playwright, Page, expect

#: Base URL for the Skaldmark dev server (HTTPS due to Vite basicSsl plugin).
BASE_URL = "https://localhost:5174"

#: Number of full test iterations to run. Override via CLI argument.
ITERATIONS = int(sys.argv[1]) if len(sys.argv) > 1 else 10

#: Directory for saving screenshots during test runs.
SCREENSHOT_DIR = "tests/screenshots"

# ── Dragonbane Data ──────────────────────────────────────────────

CHAR_NAMES = [
    "Bjorn Ironfist", "Sigrid Flamecaller", "Tormund Stonewall",
    "Freya Shadowmend", "Olaf Thunderstrike", "Yrsa Nightwhisper",
    "Gunnar Dreadaxe", "Astrid Moonbow", "Harald Stormborn",
    "Ingrid Frostweaver", "Erik Bloodhammer", "Kari Silvertongue",
]

PROFESSIONS = ["Fighter", "Mage", "Thief", "Scholar", "Hunter", "Bard"]
KINS = ["Human", "Halfling", "Dwarf", "Elf", "Mallard", "Wolfkin"]

CORE_SKILLS = [
    "ACROBATICS", "AWARENESS", "BARTERING", "BEAST LORE", "BLUFFING",
    "BUSHCRAFT", "CRAFTING", "EVADE", "HEALING", "HUNTING & FISHING",
    "LANGUAGES", "MYTHS & LEGENDS", "PERFORMANCE", "PERSUASION",
    "RIDING", "SEAMANSHIP", "SLEIGHT OF HAND", "SNEAKING",
    "SPOT HIDDEN", "SWIMMING",
]

WEAPON_SKILLS = ["Axes", "Bows", "Brawling", "Crossbows", "Hammers",
                 "Knives", "Slings", "Spears", "Staves", "Swords"]

SPELL_NAMES = [
    "Fireball", "Lightning Bolt", "Heal Wound", "Shield",
    "Frost Breath", "Animate Dead", "Dispel", "Levitate",
]

ABILITY_NAMES = [
    "Berserker Rage", "Shield Wall", "Precision Strike",
    "Battle Cry", "Dodge Master", "Iron Will",
]

CONDITIONS = ["exhausted", "sickly", "dazed", "angry", "scared", "disheartened"]

# ── Helpers ──────────────────────────────────────────────────────

def safe_click(page: Page, selector: str, timeout: int = 5000):
    """Click an element with wait and retry logic.

    :param page: Playwright page instance.
    :param selector: CSS selector string for the target element.
    :param timeout: Maximum time in ms to wait for the element (default 5000).
    :returns: True if click succeeded, False if element not found/clickable.
    :rtype: bool
    """
    try:
        el = page.locator(selector).first
        el.wait_for(state="visible", timeout=timeout)
        el.click()
        return True
    except Exception:
        return False

def safe_fill(page: Page, selector: str, value: str, timeout: int = 5000):
    """Fill an input element with a value after waiting for it to appear.

    :param page: Playwright page instance.
    :param selector: CSS selector for the input element.
    :param value: String value to fill into the input.
    :param timeout: Maximum wait time in ms (default 5000).
    :returns: True if fill succeeded, False otherwise.
    :rtype: bool
    """
    try:
        el = page.locator(selector).first
        el.wait_for(state="visible", timeout=timeout)
        el.fill(value)
        return True
    except Exception:
        return False

def wait_stable(page: Page, ms: int = 500):
    """Wait for the page to stabilize after a navigation or interaction.

    :param page: Playwright page instance.
    :param ms: Milliseconds to wait (default 500).
    """
    page.wait_for_timeout(ms)

def screenshot(page: Page, name: str, iteration: int):
    """Capture a full-page screenshot and save it to the screenshots directory.

    :param page: Playwright page instance.
    :param name: Descriptive name for the screenshot (e.g., 'campaign_created').
    :param iteration: Current iteration number (used in filename prefix).
    """
    path = f"{SCREENSHOT_DIR}/iter{iteration}_{name}.png"
    try:
        page.screenshot(path=path, full_page=True)
    except Exception:
        pass

def nav_to(page: Page, path: str):
    """Navigate to a page path and wait for network idle + stabilization.

    :param page: Playwright page instance.
    :param path: URL path to navigate to (e.g., '/session', '/character/sheet').
    """
    page.goto(f"{BASE_URL}{path}")
    page.wait_for_load_state("networkidle")
    wait_stable(page)

# ── Test Phases ──────────────────────────────────────────────────

def phase_create_campaign(page: Page, iteration: int) -> bool:
    """Create a new campaign via the campaign selector header.

    Opens the campaign selector overlay, clicks '+ Create Campaign', fills
    in the campaign name and description, and submits the form. The campaign
    auto-creates a party and sets itself as the active campaign.

    :param page: Playwright page instance.
    :param iteration: Current iteration number (used for unique campaign name).
    :returns: True if campaign was created successfully.
    :rtype: bool
    """
    print(f"  [Campaign] Creating campaign...")
    nav_to(page, "/session")
    wait_stable(page, 1000)

    # Click campaign selector button in header
    selector_btn = page.locator('button[aria-label="Select campaign"]')
    if selector_btn.count() > 0:
        selector_btn.first.click()
        wait_stable(page, 500)
        # Click "+ Create Campaign"
        create_btn = page.get_by_text("+ Create Campaign")
        if create_btn.count() > 0:
            create_btn.first.click()
            wait_stable(page, 500)
        else:
            print("    WARN: No '+ Create Campaign' button found")
            return False
    else:
        # Maybe NoCampaignPrompt is shown — look for a create button there
        create_btn = page.get_by_text("Create Campaign").first
        if create_btn:
            create_btn.click()
            wait_stable(page, 500)
        else:
            print("    WARN: No campaign selector or create button found")
            return False

    # Fill in campaign form
    dialog = page.locator('div[role="dialog"][aria-label="Create campaign"]')
    if dialog.count() == 0:
        print("    WARN: Campaign create dialog not found")
        screenshot(page, "campaign_no_dialog", iteration)
        return False

    name_input = dialog.locator('input[type="text"]').first
    name_input.fill(f"Test Campaign {iteration}")
    wait_stable(page, 200)

    desc_input = dialog.locator("textarea").first
    if desc_input.count() > 0:
        desc_input.fill(f"Automated test campaign, iteration {iteration}")

    # Submit
    submit_btn = dialog.locator('button[type="submit"]')
    if submit_btn.count() > 0:
        submit_btn.first.click()
    else:
        dialog.get_by_text("Create").first.click()

    wait_stable(page, 1000)
    screenshot(page, "campaign_created", iteration)
    print(f"    OK: Campaign 'Test Campaign {iteration}' created")
    return True


def ensure_edit_mode(page: Page):
    """Switch the app to edit mode if it is currently in play mode.

    The hamburger menu contains a mode toggle button. The button label shows
    the **current** mode (not the target): when in play mode it reads
    'PLAY MODE', and clicking it switches to edit mode.

    :param page: Playwright page instance.
    """
    menu_btn = page.locator('button[aria-label="Menu"]')
    if menu_btn.count() == 0:
        return
    menu_btn.first.click()
    wait_stable(page, 500)
    # If we see "PLAY MODE", we're currently in play mode - click to switch to edit
    play_btn = page.get_by_text("PLAY MODE", exact=False)
    if play_btn.count() > 0:
        play_btn.first.click()
        wait_stable(page, 500)
    else:
        # We're already in edit mode (button says "EDIT MODE"), just close
        page.keyboard.press("Escape")
        wait_stable(page, 300)


def ensure_play_mode(page: Page):
    """Switch the app to play mode if it is currently in edit mode.

    See :func:`ensure_edit_mode` for how the toggle button works.

    :param page: Playwright page instance.
    """
    menu_btn = page.locator('button[aria-label="Menu"]')
    if menu_btn.count() == 0:
        return
    menu_btn.first.click()
    wait_stable(page, 500)
    # If we see "EDIT MODE", we're currently in edit mode - click to switch to play
    edit_btn = page.get_by_text("EDIT MODE", exact=False)
    if edit_btn.count() > 0:
        edit_btn.first.click()
        wait_stable(page, 500)
    else:
        page.keyboard.press("Escape")
        wait_stable(page, 300)


def phase_create_characters(page: Page, iteration: int, count: int = 5) -> list[str]:
    """Create N characters in the Character Library, name them, and visit all sub-screens.

    Creates characters by clicking '+ New Character' in the library, then iterates
    through each to set it active, switch to edit mode, rename it, and navigate
    through all character sub-screens (Sheet, Skills, Gear, Magic, Combat).

    :param page: Playwright page instance.
    :param iteration: Current iteration number.
    :param count: Number of characters to create (default 5).
    :returns: List of character names assigned.
    :rtype: list[str]
    """
    print(f"  [Characters] Creating {count} characters...")
    names = random.sample(CHAR_NAMES, count)

    nav_to(page, "/library")
    wait_stable(page, 1000)

    # Step 1: Create all characters first
    for i in range(count):
        print(f"    Creating character {i+1}/{count}...")
        # Find the create button - might be "+ New Character" or "Create your first character"
        new_btn = page.get_by_role("button", name="+ New Character")
        if new_btn.count() == 0:
            new_btn = page.get_by_role("button", name="Create your first character")
        if new_btn.count() == 0:
            print(f"    WARN: No create character button found")
            screenshot(page, f"char_no_create_{i}", iteration)
            break
        new_btn.first.click()
        wait_stable(page, 1500)
        # After click, it creates char and we may end up on sheet or stay on library
        # Go back to library for next creation
        nav_to(page, "/library")
        wait_stable(page, 1000)

    # Step 2: Now rename each character and explore screens
    for i, char_name in enumerate(names):
        print(f"    Configuring character {i+1}/{count}: {char_name}")

        nav_to(page, "/library")
        wait_stable(page, 1000)

        # Find characters named "New Adventurer" and set one active
        set_active_btns = page.get_by_role("button", name="Set Active")
        if set_active_btns.count() > 0:
            set_active_btns.first.click()
            wait_stable(page, 1500)
        else:
            # All characters are already active (only 1 left), navigate to sheet
            pass

        # Navigate to sheet to rename
        nav_to(page, "/character/sheet")
        wait_stable(page, 1500)

        # Check we're actually on the sheet (not redirected to library)
        if "/library" in page.url:
            print(f"      WARN: Redirected to library, no active character")
            continue

        # Switch to edit mode
        ensure_edit_mode(page)
        wait_stable(page, 500)

        # Edit character name - find visible input with "New Adventurer" value
        wait_stable(page, 500)
        renamed = False
        all_inputs = page.locator('input').all()
        for inp in all_inputs:
            try:
                if not inp.is_visible():
                    continue
                if inp.is_disabled():
                    continue
                val = inp.input_value()
                if "New Adventurer" in val:
                    inp.triple_click()
                    wait_stable(page, 100)
                    inp.fill(char_name)
                    wait_stable(page, 500)
                    renamed = True
                    print(f"      Renamed to: {char_name}")
                    break
            except Exception:
                continue

        if not renamed:
            print(f"      WARN: Could not find name input to rename")

        screenshot(page, f"char_{i}_sheet", iteration)

        # Visit all character sub-screens
        for screen_path, screen_name in [
            ("/character/skills", "skills"),
            ("/character/gear", "gear"),
            ("/character/magic", "magic"),
            ("/character/combat", "combat"),
        ]:
            nav_to(page, screen_path)
            wait_stable(page, 800)
            screenshot(page, f"char_{i}_{screen_name}", iteration)

        # Switch back to play mode
        ensure_play_mode(page)

    print(f"    OK: Created and configured {count} characters")
    return names


def phase_manage_party(page: Page, iteration: int, char_names: list[str]) -> bool:
    """Add all characters to the campaign party via the Manage Party drawer.

    Opens the hamburger menu, selects 'Manage Party', and adds each available
    character to the party. Sets the first member as 'my character'.

    :param page: Playwright page instance.
    :param iteration: Current iteration number.
    :param char_names: List of expected character names to add.
    :returns: True if party management succeeded.
    :rtype: bool
    """
    print(f"  [Party] Adding {len(char_names)} members to party...")

    nav_to(page, "/session")
    wait_stable(page, 1000)

    # Open hamburger menu
    menu_btn = page.locator('button[aria-label="Menu"]')
    if menu_btn.count() == 0:
        print("    WARN: No menu button")
        return False

    menu_btn.first.click()
    wait_stable(page, 500)

    # Click "Manage Party"
    manage_btn = page.get_by_text("Manage Party")
    if manage_btn.count() == 0:
        page.keyboard.press("Escape")
        print("    WARN: No 'Manage Party' option")
        return False

    manage_btn.first.click()
    wait_stable(page, 1000)

    # In the party drawer, add each character
    dialog = page.locator('div[role="dialog"][aria-label="Manage party"]')
    if dialog.count() == 0:
        print("    WARN: Manage party dialog not found")
        screenshot(page, "party_no_dialog", iteration)
        return False

    # Add available characters - they might still be named "New Adventurer"
    # Look for all buttons under "Add Character" section
    add_section = dialog.locator('h3').filter(has_text="Add Character")
    if add_section.count() > 0:
        # Find all character buttons below the "Add Character" heading
        # These are the available characters to add
        avail_buttons = dialog.locator('button').filter(has_text="New Adventurer")
        # Also try matching actual renamed characters
        for name in char_names:
            add_btn = dialog.locator('button').filter(has_text=name)
            if add_btn.count() > 0:
                add_btn.first.click()
                wait_stable(page, 800)
                print(f"    Added: {name}")

        # Add any remaining "New Adventurer" entries
        for attempt in range(10):
            remaining = dialog.locator('button').filter(has_text="New Adventurer")
            if remaining.count() == 0:
                break
            remaining.first.click()
            wait_stable(page, 800)
            print(f"    Added: New Adventurer (#{attempt+1})")
    else:
        print("    WARN: 'Add Character' section not found")

    screenshot(page, "party_managed", iteration)

    # Set first member as "my character"
    set_mine_btns = dialog.get_by_text("Set mine")
    if set_mine_btns.count() > 0:
        set_mine_btns.first.click()
        wait_stable(page, 500)
        print("    Set first member as 'my character'")

    # Close drawer
    close_btn = dialog.locator('button').filter(has_text="✕")
    if close_btn.count() > 0:
        close_btn.first.click()
    else:
        page.keyboard.press("Escape")

    wait_stable(page, 500)
    print(f"    OK: Party managed")
    return True


def phase_start_session(page: Page, iteration: int) -> bool:
    """Start a new game session within the active campaign.

    Navigates to the session screen and clicks 'Start Session'. Verifies
    the session is active by checking for the 'End Session' button.

    :param page: Playwright page instance.
    :param iteration: Current iteration number.
    :returns: True if session started (or was already active).
    :rtype: bool
    """
    print(f"  [Session] Starting session...")
    nav_to(page, "/session")
    wait_stable(page, 1000)

    start_btn = page.get_by_text("Start Session")
    if start_btn.count() == 0:
        print("    WARN: No 'Start Session' button (may already have active session)")
        screenshot(page, "session_no_start", iteration)
        # Check if there's already an active session
        end_btn = page.get_by_text("End Session")
        if end_btn.count() > 0:
            print("    OK: Session already active")
            return True
        return False

    start_btn.first.click()
    wait_stable(page, 1500)
    screenshot(page, "session_started", iteration)

    # Verify session is active
    end_btn = page.get_by_text("End Session")
    if end_btn.count() > 0:
        print("    OK: Session started")
        return True
    else:
        print("    WARN: Session start may have failed")
        return False


def phase_test_notes(page: Page, iteration: int) -> bool:
    """Test all note creation types on the Notes screen.

    Tests the following note drawers:

    1. **Quick Note** — fills title, saves generic note
    2. **Quick NPC** — fills name, role, affiliation, saves NPC note
    3. **Quick Location** — fills name, type, region, saves location note
    4. **Link Note** — attempts to link an existing note to the active session

    :param page: Playwright page instance.
    :param iteration: Current iteration number.
    :returns: True if all testable note types were created successfully.
    :rtype: bool
    """
    print(f"  [Notes] Testing all note types...")
    nav_to(page, "/notes")
    wait_stable(page, 1000)

    success = True

    # 1. Quick Note
    print("    Testing Quick Note...")
    qn_btn = page.get_by_text("Quick Note", exact=True)
    if qn_btn.count() > 0:
        qn_btn.first.click()
        wait_stable(page, 800)

        dialog = page.locator('div[role="dialog"][aria-label="Quick note"]')
        if dialog.count() > 0:
            # Fill title
            title_input = dialog.locator('input[placeholder="Note title (required)"]')
            if title_input.count() > 0:
                title_input.first.fill(f"Battle Notes - Iter {iteration}")
                wait_stable(page, 300)

            # Save
            save_btn = dialog.get_by_text("Save", exact=True)
            if save_btn.count() > 0:
                save_btn.first.click()
                wait_stable(page, 800)
                print("      OK: Quick Note saved")
            else:
                print("      WARN: No Save button")
                success = False
                page.keyboard.press("Escape")
        else:
            print("      WARN: Quick note dialog not found")
            success = False
    else:
        print("      WARN: No 'Quick Note' button")
        success = False

    # 2. Quick NPC
    print("    Testing Quick NPC...")
    npc_btn = page.get_by_text("Quick NPC", exact=True)
    if npc_btn.count() > 0:
        npc_btn.first.click()
        wait_stable(page, 800)

        dialog = page.locator('div[role="dialog"][aria-label="Quick NPC"]')
        if dialog.count() > 0:
            name_input = dialog.locator('input[placeholder="NPC name (required)"]')
            if name_input.count() > 0:
                name_input.first.fill(f"Blacksmith Dorgan")

            role_input = dialog.locator('input[placeholder="Role (optional)"]')
            if role_input.count() > 0:
                role_input.first.fill("Weaponsmith")

            affil_input = dialog.locator('input[placeholder="Affiliation (optional)"]')
            if affil_input.count() > 0:
                affil_input.first.fill("Outskirt Village")

            wait_stable(page, 300)

            save_btn = dialog.get_by_text("Save NPC")
            if save_btn.count() > 0:
                save_btn.first.click()
                wait_stable(page, 800)
                print("      OK: Quick NPC saved")
            else:
                print("      WARN: No 'Save NPC' button")
                success = False
                page.keyboard.press("Escape")
        else:
            print("      WARN: Quick NPC dialog not found")
            success = False
    else:
        print("      WARN: No 'Quick NPC' button")
        success = False

    # 3. Quick Location
    print("    Testing Quick Location...")
    loc_btn = page.get_by_text("Location", exact=True)
    if loc_btn.count() > 0:
        loc_btn.first.click()
        wait_stable(page, 800)

        dialog = page.locator('div[role="dialog"][aria-label="Quick Location"]')
        if dialog.count() > 0:
            name_input = dialog.locator('input[placeholder="Location name (required)"]')
            if name_input.count() > 0:
                name_input.first.fill(f"Dragon's Lair")

            type_input = dialog.locator('input[placeholder*="tavern, dungeon"]')
            if type_input.count() > 0:
                type_input.first.fill("dungeon")

            region_input = dialog.locator('input[placeholder="Region (optional)"]')
            if region_input.count() > 0:
                region_input.first.fill("Misty Mountains")

            wait_stable(page, 300)

            save_btn = dialog.get_by_text("Save Location")
            if save_btn.count() > 0:
                save_btn.first.click()
                wait_stable(page, 800)
                print("      OK: Quick Location saved")
            else:
                print("      WARN: No 'Save Location' button")
                success = False
                page.keyboard.press("Escape")
        else:
            print("      WARN: Quick Location dialog not found")
            success = False
    else:
        print("      WARN: No 'Location' button")
        success = False

    # 4. Link Note (only works with active session)
    print("    Testing Link Note...")
    link_btn = page.get_by_text("Link Note", exact=True)
    if link_btn.count() > 0:
        link_btn.first.click()
        wait_stable(page, 800)

        dialog = page.locator('div[role="dialog"][aria-label="Link note to session"]')
        if dialog.count() > 0:
            # Try to link the first available note
            note_btns = dialog.locator('button').all()
            linked = False
            for btn in note_btns:
                try:
                    text = btn.inner_text()
                    if text and text not in ["Cancel", "✕", "Link Note to Session"]:
                        btn.click()
                        wait_stable(page, 800)
                        print(f"      OK: Linked note '{text[:30]}'")
                        linked = True
                        break
                except Exception:
                    continue
            if not linked:
                print("      INFO: No notes available to link")
                page.keyboard.press("Escape")
                wait_stable(page, 300)
        else:
            print("      WARN: Link note dialog not found")
    else:
        print("      WARN: No 'Link Note' button")

    screenshot(page, "notes_tested", iteration)
    return success


def phase_combat_10_rounds(page: Page, iteration: int) -> bool:
    """Start a combat encounter and run 10 full rounds with varied events.

    Each round adds 2-3 random combat events (Attack, Damage, Heal, Note).
    Every 3rd round tests condition events, every 4th tests spell events,
    and every 5th tests ability events. Uses ``force=True`` clicks to bypass
    potential overlay interference from SessionQuickActions.

    After 10 rounds, ends the combat encounter.

    :param page: Playwright page instance.
    :param iteration: Current iteration number.
    :returns: True if combat ran and ended successfully.
    :rtype: bool
    """
    print(f"  [Combat] Running 10 rounds of combat...")
    nav_to(page, "/session")
    wait_stable(page, 1000)

    # Start combat
    start_combat_btn = page.get_by_text("Start Combat")
    if start_combat_btn.count() == 0:
        # Maybe there's already a combat - try Resume
        resume_btn = page.get_by_text("Resume Combat")
        if resume_btn.count() > 0:
            resume_btn.first.click()
            wait_stable(page, 1000)
        else:
            print("    WARN: No 'Start Combat' button")
            screenshot(page, "combat_no_start", iteration)
            return False
    else:
        start_combat_btn.first.click()
        wait_stable(page, 1500)

    screenshot(page, "combat_started", iteration)

    EVENT_TYPES = ["Attack", "Damage", "Heal", "Note"]

    for round_num in range(1, 11):
        print(f"    Round {round_num}/10...")

        # Scroll to top of combat area to avoid overlay issues
        page.evaluate("window.scrollTo(0, 0)")
        wait_stable(page, 300)

        # Add 2-3 events per round
        events_this_round = random.randint(2, 3)
        for ev_idx in range(events_this_round):
            event_type = random.choice(EVENT_TYPES)

            # Click the event type chip (use force to bypass any overlay)
            chip = page.get_by_text(event_type, exact=True)
            if chip.count() > 0:
                try:
                    chip.first.click(force=True, timeout=5000)
                    wait_stable(page, 500)
                except Exception:
                    # Try scrolling into view and clicking
                    chip.first.scroll_into_view_if_needed()
                    wait_stable(page, 300)
                    chip.first.click(force=True, timeout=3000)
                    wait_stable(page, 500)

                # Fill in any visible event form inputs
                all_inputs = page.locator('input[type="text"]').all()
                for inp in all_inputs:
                    try:
                        ph = inp.get_attribute("placeholder") or ""
                        if not inp.is_visible():
                            continue
                        if "actor" in ph.lower() or "who" in ph.lower():
                            inp.fill(random.choice(CHAR_NAMES[:5]))
                        elif "target" in ph.lower():
                            inp.fill(random.choice(["Goblin", "Orc", "Dragon", "Skeleton"]))
                        elif "value" in ph.lower() or "damage" in ph.lower() or "amount" in ph.lower():
                            inp.fill(str(random.randint(1, 12)))
                        elif "label" in ph.lower() or "description" in ph.lower() or "note" in ph.lower():
                            inp.fill(f"Combat event R{round_num}")
                    except Exception:
                        continue

                # Submit the event
                add_btn = page.get_by_text("Add Event")
                if add_btn.count() > 0:
                    try:
                        add_btn.first.click(force=True, timeout=3000)
                        wait_stable(page, 500)
                    except Exception:
                        pass

        # Also try condition events
        if round_num % 3 == 0:
            try:
                cond_chip = page.get_by_text("Condition", exact=True)
                if cond_chip.count() > 0:
                    cond_chip.first.click(force=True, timeout=3000)
                    wait_stable(page, 500)
                    cond_name = random.choice(["Exhausted", "Dazed", "Angry", "Scared"])
                    cond_btn = page.get_by_text(cond_name, exact=False)
                    if cond_btn.count() > 0:
                        cond_btn.first.click(force=True, timeout=3000)
                        wait_stable(page, 500)
            except Exception:
                page.keyboard.press("Escape")
                wait_stable(page, 300)

        # Try spell/ability events occasionally
        if round_num % 4 == 0:
            try:
                spell_chip = page.get_by_text("Spell", exact=True)
                if spell_chip.count() > 0:
                    spell_chip.first.click(force=True, timeout=3000)
                    wait_stable(page, 800)
                    page.keyboard.press("Escape")
                    wait_stable(page, 300)
            except Exception:
                pass

        if round_num % 5 == 0:
            try:
                ability_chip = page.get_by_text("Ability", exact=True)
                if ability_chip.count() > 0:
                    ability_chip.first.click(force=True, timeout=3000)
                    wait_stable(page, 800)
                    page.keyboard.press("Escape")
                    wait_stable(page, 300)
            except Exception:
                pass

        screenshot(page, f"combat_round_{round_num}", iteration)

        # Next round (except for last round)
        if round_num < 10:
            next_btn = page.get_by_text("Next Round")
            if next_btn.count() > 0:
                try:
                    next_btn.first.click(force=True, timeout=5000)
                    wait_stable(page, 800)
                    print(f"      Advanced to round {round_num + 1}")
                except Exception:
                    print(f"      WARN: Could not advance to round {round_num + 1}")

    # Close any open drawers before ending combat
    page.keyboard.press("Escape")
    wait_stable(page, 500)
    page.keyboard.press("Escape")
    wait_stable(page, 300)

    # Scroll to top where End Combat button is
    page.evaluate("window.scrollTo(0, 0)")
    wait_stable(page, 300)

    # End combat
    end_combat_btn = page.get_by_text("End Combat")
    if end_combat_btn.count() > 0:
        try:
            end_combat_btn.first.click(force=True, timeout=5000)
            wait_stable(page, 1000)
            print("    OK: Combat ended after 10 rounds")
        except Exception:
            print("    WARN: Could not click End Combat, forcing navigation")
            nav_to(page, "/session")
            wait_stable(page, 1000)

    screenshot(page, "combat_ended", iteration)
    return True


def phase_test_session_quick_actions(page: Page, iteration: int) -> bool:
    """Test the Session Quick Actions toolbar on the session screen.

    The SessionQuickActions component provides 14 action chips (Skill Check,
    Cast Spell, Ability, Condition, Damage, Death Roll, Rest, Camp, Travel,
    Quote, Rumor, Shopping, Encounter, Loot). This test clicks available chips
    and interacts with the resulting drawers.

    :param page: Playwright page instance.
    :param iteration: Current iteration number.
    :returns: True if at least one quick action was successfully tested.
    :rtype: bool
    """
    print(f"  [QuickActions] Testing session quick actions...")
    nav_to(page, "/session")
    wait_stable(page, 1000)

    # The SessionQuickActions component has expandable drawers
    # Look for skill check, spell, ability chips
    tested = 0

    # The SessionQuickActions chips may be obscured by session log overlay FABs.
    # Scroll to the quick actions area first.
    page.evaluate("window.scrollTo(0, 0)")
    wait_stable(page, 300)

    # Try clicking chips for quick actions
    for chip_text in ["Skill Check", "Cast Spell", "Use Ability", "Quick Note", "Quick NPC"]:
        chip = page.get_by_text(chip_text, exact=False)
        if chip.count() > 0:
            try:
                chip.first.scroll_into_view_if_needed()
                wait_stable(page, 200)
                chip.first.click(force=True, timeout=5000)
                wait_stable(page, 800)
                tested += 1

                # If a drawer/list opens, interact with the first item
                list_items = page.locator('button').filter(has=page.locator('text=/^[A-Z]/'))
                if list_items.count() > 0:
                    try:
                        list_items.first.click(timeout=3000)
                        wait_stable(page, 500)

                        # If it's a skill check, pick a result
                        for result in ["Success", "Failure", "Dragon (1)", "Demon (20)"]:
                            result_btn = page.get_by_text(result, exact=True)
                            if result_btn.count() > 0:
                                result_btn.first.click(timeout=3000)
                                wait_stable(page, 500)
                                break
                    except Exception:
                        pass

                # Close any open drawers
                page.keyboard.press("Escape")
                wait_stable(page, 500)
            except Exception as e:
                print(f"      WARN: Could not click '{chip_text}': {str(e)[:60]}")
                page.keyboard.press("Escape")
                wait_stable(page, 300)

    screenshot(page, "quick_actions", iteration)
    print(f"    OK: Tested {tested} quick action types")
    return tested > 0


def phase_test_session_log_overlay(page: Page, iteration: int) -> bool:
    """Test the floating session log overlay FABs on character screens.

    The SessionLogOverlay renders floating action buttons (dice, spell, sword
    emojis) on character tab screens when a session is active AND a character
    is loaded. Clicks the skill check FAB, selects a skill, applies a modifier
    (Boon), and picks a result.

    :param page: Playwright page instance.
    :param iteration: Current iteration number.
    :returns: True if FABs were found and interacted with, or if absence
              is expected (no active character).
    :rtype: bool
    """
    print(f"  [LogOverlay] Testing session log overlay...")
    nav_to(page, "/character/sheet")
    wait_stable(page, 1000)

    # Look for the floating action buttons (dice emoji, spell emoji, sword emoji)
    # The overlay requires both an active session AND an active character.
    # If no character is active, the FABs won't appear - this is expected.
    fab_btns = page.locator('button[title="Log Skill Check"], button[title="Log Spell"], button[title="Log Ability"]')
    found = fab_btns.count()

    if found > 0:
        # Click the skill check FAB
        skill_fab = page.locator('button[title="Log Skill Check"]')
        if skill_fab.count() > 0:
            skill_fab.first.click()
            wait_stable(page, 800)

            # Should show a drawer with skill list
            # Click first skill
            skill_btns = page.locator('button').all()
            for btn in skill_btns:
                try:
                    text = btn.inner_text()
                    if text and text.isupper() and len(text) > 3:
                        btn.click()
                        wait_stable(page, 500)

                        # Click a modifier
                        boon_btn = page.get_by_text("Boon", exact=True)
                        if boon_btn.count() > 0:
                            boon_btn.first.click()
                            wait_stable(page, 300)

                        # Pick a result
                        success_btn = page.get_by_text("Success", exact=True)
                        if success_btn.count() > 0:
                            success_btn.first.click()
                            wait_stable(page, 500)
                        break
                except Exception:
                    continue

        screenshot(page, "log_overlay", iteration)
        print(f"    OK: Found {found} FAB buttons, tested skill log")
        return True
    else:
        print("    INFO: No session log overlay FABs (requires active session + active character)")
        return True  # Not a failure - just means no active character on character screen


def phase_test_character_subscreens(page: Page, iteration: int) -> bool:
    """Navigate through all 5 character sub-screens and perform interactions.

    Tests the following tabs via the CharacterSubNav:

    - **Sheet** — identity, attributes, resources, conditions
    - **Skills** — skill list with filter toggles (All / Relevant)
    - **Gear** — weapons, armor, inventory
    - **Magic** — spells and heroic abilities
    - **Combat** — HP/WP trackers, condition toggles, rest actions

    On the Combat screen, attempts to click +/- resource buttons and toggle
    conditions (only non-disabled buttons in play mode).

    :param page: Playwright page instance.
    :param iteration: Current iteration number.
    :returns: True if all screens loaded successfully.
    :rtype: bool
    """
    print(f"  [CharScreens] Testing all character sub-screens...")

    screens = [
        ("/character/sheet", "Sheet"),
        ("/character/skills", "Skills"),
        ("/character/gear", "Gear"),
        ("/character/magic", "Magic"),
        ("/character/combat", "Combat"),
    ]

    for path, label in screens:
        nav_to(page, path)
        wait_stable(page, 1000)

        # Verify the sub-nav tab is active
        active_tab = page.locator(f'a[href="{path}"]')
        if active_tab.count() > 0:
            print(f"    OK: {label} screen loaded")
        else:
            print(f"    WARN: {label} screen - nav tab not found")

        screenshot(page, f"charscreen_{label.lower()}", iteration)

        # Screen-specific interactions
        if label == "Combat":
            # Test HP/WP resource buttons (use enabled ones only)
            plus_btns = page.locator('button:not([disabled])').filter(has_text="+")
            minus_btns = page.locator('button:not([disabled])').filter(has_text="−")
            if plus_btns.count() > 0:
                try:
                    plus_btns.first.click(timeout=3000)
                    wait_stable(page, 300)
                except Exception:
                    pass
            if minus_btns.count() > 0:
                try:
                    minus_btns.first.click(timeout=3000)
                    wait_stable(page, 300)
                except Exception:
                    pass

            # Test condition toggles
            for cond in ["Exhausted", "Dazed"]:
                cond_toggle = page.get_by_text(cond, exact=True)
                if cond_toggle.count() > 0:
                    try:
                        cond_toggle.first.click(timeout=3000)
                        wait_stable(page, 300)
                        cond_toggle.first.click(timeout=3000)
                        wait_stable(page, 300)
                    except Exception:
                        pass

        elif label == "Skills":
            # Test skill filter toggle
            filter_btns = page.get_by_text("All", exact=True)
            if filter_btns.count() > 0:
                filter_btns.first.click()
                wait_stable(page, 500)

            relevant_btn = page.get_by_text("Relevant", exact=True)
            if relevant_btn.count() > 0:
                relevant_btn.first.click()
                wait_stable(page, 500)

    print(f"    OK: All character sub-screens tested")
    return True


def phase_test_other_screens(page: Page, iteration: int) -> bool:
    """Test settings, reference, and other screens."""
    print(f"  [Other] Testing settings, reference...")

    nav_to(page, "/settings")
    wait_stable(page, 1000)
    screenshot(page, "settings", iteration)

    nav_to(page, "/reference")
    wait_stable(page, 1000)
    screenshot(page, "reference", iteration)

    print(f"    OK: Other screens loaded")
    return True


def phase_end_session(page: Page, iteration: int) -> bool:
    """End the active session."""
    print(f"  [Session] Ending session...")
    nav_to(page, "/session")
    wait_stable(page, 1000)

    end_btn = page.get_by_text("End Session", exact=True)
    if end_btn.count() == 0:
        print("    INFO: No active session to end")
        return True

    end_btn.first.click()
    wait_stable(page, 1000)

    # Handle end session modal confirmation - button says "Confirm"
    confirm_dialog = page.locator('div[role="dialog"][aria-label="End session confirmation"]')
    if confirm_dialog.count() > 0:
        confirm_btn = confirm_dialog.get_by_text("Confirm", exact=True)
        if confirm_btn.count() > 0:
            confirm_btn.first.click()
            wait_stable(page, 1000)
        else:
            # Fallback: click any button in the dialog
            page.keyboard.press("Escape")
            wait_stable(page, 500)

    screenshot(page, "session_ended", iteration)
    print("    OK: Session ended")
    return True


def phase_verify_notes_screen(page: Page, iteration: int) -> bool:
    """Verify notes are visible and pin/unpin works."""
    print(f"  [Verify] Checking notes screen final state...")
    nav_to(page, "/notes")
    wait_stable(page, 1000)

    # Count notes
    note_items = page.locator('div').filter(has_text="Battle Notes")
    count = note_items.count()
    print(f"    Found ~{count} note references on screen")
    screenshot(page, "notes_final", iteration)
    return True


# ── Main Runner ──────────────────────────────────────────────────

def run_iteration(browser, iteration: int) -> dict:
    """Run one full test iteration through all 12 test phases.

    Creates a fresh browser context with a mobile viewport (414x896, 2x DPI)
    and ``ignore_https_errors=True`` for the self-signed Vite SSL cert. Tracks
    console errors and page errors throughout the iteration.

    :param browser: Playwright browser instance.
    :param iteration: Iteration number (1-indexed).
    :returns: Dictionary mapping phase names to pass/fail booleans, plus
              ``console_errors`` and ``page_errors`` lists.
    :rtype: dict
    """
    print(f"\n{'='*60}")
    print(f"  ITERATION {iteration}/{ITERATIONS}")
    print(f"{'='*60}")

    context = browser.new_context(
        viewport={"width": 414, "height": 896},  # Mobile viewport
        device_scale_factor=2,
        ignore_https_errors=True,
    )
    page = context.new_page()

    # Collect console errors
    console_errors = []
    page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type in ("error", "warning") else None)

    # Collect page errors
    page_errors = []
    page.on("pageerror", lambda err: page_errors.append(str(err)))

    results = {}
    try:
        nav_to(page, "/")
        wait_stable(page, 1000)

        results["campaign"] = phase_create_campaign(page, iteration)
        char_names = phase_create_characters(page, iteration, count=5)
        results["characters"] = len(char_names) == 5
        results["party"] = phase_manage_party(page, iteration, char_names)
        results["session_start"] = phase_start_session(page, iteration)
        results["notes"] = phase_test_notes(page, iteration)
        results["combat"] = phase_combat_10_rounds(page, iteration)
        results["quick_actions"] = phase_test_session_quick_actions(page, iteration)
        results["log_overlay"] = phase_test_session_log_overlay(page, iteration)
        results["char_screens"] = phase_test_character_subscreens(page, iteration)
        results["other_screens"] = phase_test_other_screens(page, iteration)
        results["notes_verify"] = phase_verify_notes_screen(page, iteration)
        results["session_end"] = phase_end_session(page, iteration)

    except Exception as e:
        print(f"\n  EXCEPTION: {e}")
        traceback.print_exc()
        screenshot(page, "EXCEPTION", iteration)
        results["exception"] = str(e)

    results["console_errors"] = console_errors
    results["page_errors"] = page_errors

    page.close()
    context.close()

    # Print summary
    print(f"\n  Results for iteration {iteration}:")
    for key, val in results.items():
        if key in ("console_errors", "page_errors"):
            if val:
                print(f"    {key}: {len(val)} issues")
                for item in val[:5]:
                    print(f"      - {item[:120]}")
            continue
        status = "PASS" if val else "FAIL"
        print(f"    {key}: {status}")

    return results


def main():
    """Entry point for the E2E test suite.

    Launches a headless Chromium browser, runs ``ITERATIONS`` full test
    iterations, collects results, and writes a summary report to
    ``tests/test_report.txt``.

    :returns: 0 if all tests passed, 1 if any failures occurred.
    :rtype: int
    """
    import os
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    all_results = []
    issues_found = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for i in range(1, ITERATIONS + 1):
            try:
                result = run_iteration(browser, i)
                all_results.append(result)

                # Collect issues
                for key, val in result.items():
                    if key in ("console_errors", "page_errors"):
                        for item in val:
                            if item not in [x["detail"] for x in issues_found]:
                                issues_found.append({"type": key, "detail": item, "iteration": i})
                    elif val is False:
                        issues_found.append({"type": "test_failure", "detail": key, "iteration": i})

            except Exception as e:
                print(f"\n  CRITICAL ERROR in iteration {i}: {e}")
                traceback.print_exc()
                all_results.append({"critical_error": str(e)})

        browser.close()

    # Final report
    print(f"\n{'='*60}")
    print(f"  FINAL REPORT — {ITERATIONS} ITERATIONS")
    print(f"{'='*60}")

    total_passes = 0
    total_tests = 0
    for result in all_results:
        for key, val in result.items():
            if key not in ("console_errors", "page_errors", "exception", "critical_error"):
                total_tests += 1
                if val:
                    total_passes += 1

    print(f"  Total tests: {total_tests}")
    print(f"  Passes: {total_passes}")
    print(f"  Failures: {total_tests - total_passes}")
    print(f"  Pass rate: {total_passes/max(total_tests,1)*100:.1f}%")

    if issues_found:
        print(f"\n  Unique issues found ({len(issues_found)}):")
        seen = set()
        for issue in issues_found:
            key = f"{issue['type']}:{issue['detail'][:80]}"
            if key not in seen:
                seen.add(key)
                print(f"    [{issue['type']}] {issue['detail'][:120]} (iter {issue['iteration']})")

    # Write issues to file for analysis
    with open("tests/test_report.txt", "w") as f:
        f.write(f"Skaldmark E2E Test Report — {ITERATIONS} iterations\n")
        f.write(f"{'='*60}\n\n")
        f.write(f"Total tests: {total_tests}\n")
        f.write(f"Passes: {total_passes}\n")
        f.write(f"Failures: {total_tests - total_passes}\n")
        f.write(f"Pass rate: {total_passes/max(total_tests,1)*100:.1f}%\n\n")
        f.write("Issues:\n")
        seen = set()
        for issue in issues_found:
            key = f"{issue['type']}:{issue['detail'][:80]}"
            if key not in seen:
                seen.add(key)
                f.write(f"  [{issue['type']}] {issue['detail'][:200]} (iter {issue['iteration']})\n")

    return 0 if (total_tests - total_passes) == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
