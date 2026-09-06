"""Drives a Traveller and a Savage Worlds character sheet to confirm the
declared panels render, which the main E2E suite never reaches — it stays on the
default system throughout.

Headings use `text-transform: uppercase`, so every text assertion is
case-insensitive; Playwright's inner_text returns the rendered casing."""

import os
import sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('SKALDBOK_E2E_URL', 'https://localhost:5173')
errors = []
failures = []


def check(label, ok):
    print(f"  {'OK  ' if ok else 'FAIL'}: {label}")
    if not ok:
        failures.append(label)


def make_character(page, name, system_label):
    page.goto(f'{URL}/library', wait_until='networkidle')
    page.wait_for_timeout(800)
    page.get_by_role('button', name='New Character').first.click()
    page.wait_for_timeout(600)
    picker = page.locator('select').first
    options = picker.locator('option').all_inner_texts()
    print(f'    system options: {options}')
    picker.select_option(label=system_label)
    page.wait_for_timeout(300)
    page.get_by_placeholder('Character name').fill(name)
    page.get_by_role('button', name='Create').first.click()
    page.wait_for_timeout(1500)
    # A second character is created but NOT made active — the library offers
    # "Set Active & Edit" instead. Without this the sheet keeps showing the
    # previous character, which is what made the first run of this script report
    # a false failure for Savage Worlds.
    for label in ('Set Active & Edit', 'Set Active & Open'):
        button = page.get_by_role('button', name=label).first
        if button.count() > 0:
            button.click()
            page.wait_for_timeout(1200)
            break


def run(pw):
    browser = pw.chromium.launch()
    page = browser.new_page(ignore_https_errors=True)
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))

    print('\nTraveller sheet')
    make_character(page, 'Panel Probe T', 'Traveller')
    page.goto(f'{URL}/character/sheet', wait_until='networkidle')
    page.wait_for_timeout(1500)
    body = page.inner_text('body').lower()
    check('Careers & Creation History panel', 'careers & creation history' in body)
    check('Career History section heading', 'career history' in body)
    check('Decorations & Awards heading', 'decorations' in body)
    check('Training heading', 'training' in body)
    check('Connections sub-tables', 'allies' in body and 'enemies' in body)
    check('History & Background text block', 'history & background' in body)
    check('Augments / Species panel', 'augments / species' in body)
    check('Species Traits field label', 'species traits' in body)

    add = page.get_by_role('button', name='+ Term').first
    check('add-term button present', add.count() > 0)
    if add.count() > 0:
        add.click()
        page.wait_for_timeout(600)
        check('adding a term produced row inputs', page.locator('input[type="text"]').count() > 0)

    print('\nSavage Worlds sheet')
    make_character(page, 'Panel Probe S', 'Savage Worlds')
    page.goto(f'{URL}/character/sheet', wait_until='networkidle')
    page.wait_for_timeout(1500)
    body = page.inner_text('body').lower()
    check('Edges panel', 'edges' in body)
    check('Hindrances panel', 'hindrances' in body)
    check('Edges box keeps its placeholder',
          page.get_by_placeholder('One Edge per line', exact=False).count() > 0)
    if 'edges' not in body:
        print('    --- sheet text for diagnosis ---')
        print('    ' + page.inner_text('body')[:600].replace('\n', ' | '))

    browser.close()


with sync_playwright() as pw:
    run(pw)

real_errors = [e for e in errors if 'SSL' not in e and 'ServiceWorker' not in e]
print(f'\nconsole errors: {len(real_errors)}')
for e in real_errors[:8]:
    print('  ', e[:180])

print(f'\nfailures: {len(failures)}')
sys.exit(1 if failures or real_errors else 0)
