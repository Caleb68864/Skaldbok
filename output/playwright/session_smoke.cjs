const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:4177/';

function nowIso() {
  return new Date().toISOString();
}

function shouldIgnoreConsoleError(message) {
  return message.includes('[PWA] Service worker registration error');
}

async function seedSessionState(page) {
  await page.waitForFunction(async () => {
    if (!indexedDB.databases) {
      return true;
    }
    const databases = await indexedDB.databases();
    return databases.some((db) => db.name === 'skaldbok-db' && (db.version ?? 0) >= 8);
  });

  const seed = {
    campaignId: 'pw-campaign',
    partyId: 'pw-party',
    memberId: 'pw-member',
    activeSessionId: 'pw-session-active',
    endedSessionId: 'pw-session-ended',
    activeEncounterId: 'pw-encounter-active',
    endedEncounterId: 'pw-encounter-ended',
    sessionNoteId: 'pw-note-session',
    encounterNoteId: 'pw-note-encounter',
    timelineNodeId: 'note-pw-note-session',
    encounterNodeId: 'note-pw-note-encounter',
    now: nowIso(),
    today: new Date().toISOString().slice(0, 10),
  };

  await page.evaluate(async (payload) => {
    const request = indexedDB.open('skaldbok-db');
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const storesToClear = [
      'campaigns',
      'sessions',
      'notes',
      'entityLinks',
      'parties',
      'partyMembers',
      'attachments',
      'creatureTemplates',
      'encounters',
      'kb_nodes',
      'kb_edges',
      'characters',
      'referenceNotes',
      'metadata',
    ];

    await new Promise((resolve, reject) => {
      const tx = db.transaction(storesToClear, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);

      for (const storeName of storesToClear) {
        tx.objectStore(storeName).clear();
      }

      tx.objectStore('campaigns').add({
        id: payload.campaignId,
        name: 'Playwright Campaign',
        description: 'Session page smoke coverage',
        system: 'dragonbane',
        status: 'active',
        activeSessionId: payload.activeSessionId,
        activePartyId: payload.partyId,
        activeCharacterMemberId: payload.memberId,
        schemaVersion: 1,
        createdAt: payload.now,
        updatedAt: payload.now,
      });

      tx.objectStore('parties').add({
        id: payload.partyId,
        campaignId: payload.campaignId,
        name: 'Playwright Party',
        schemaVersion: 1,
        createdAt: payload.now,
        updatedAt: payload.now,
      });

      tx.objectStore('partyMembers').add({
        id: payload.memberId,
        partyId: payload.partyId,
        name: 'Tester',
        isActivePlayer: true,
        schemaVersion: 1,
        createdAt: payload.now,
        updatedAt: payload.now,
      });

      tx.objectStore('sessions').add({
        id: payload.activeSessionId,
        campaignId: payload.campaignId,
        title: 'Session Active',
        status: 'active',
        date: payload.today,
        startedAt: payload.now,
        schemaVersion: 1,
        createdAt: payload.now,
        updatedAt: payload.now,
      });

      tx.objectStore('sessions').add({
        id: payload.endedSessionId,
        campaignId: payload.campaignId,
        title: 'Session Ended',
        status: 'ended',
        date: payload.today,
        startedAt: payload.now,
        endedAt: payload.now,
        schemaVersion: 1,
        createdAt: payload.now,
        updatedAt: payload.now,
      });

      tx.objectStore('encounters').add({
        id: payload.activeEncounterId,
        sessionId: payload.activeSessionId,
        campaignId: payload.campaignId,
        title: 'Goblin Ambush',
        type: 'combat',
        status: 'active',
        tags: ['combat'],
        location: 'Forest Road',
        participants: [],
        segments: [{ startedAt: payload.now }],
        schemaVersion: 1,
        createdAt: payload.now,
        updatedAt: payload.now,
      });

      tx.objectStore('encounters').add({
        id: payload.endedEncounterId,
        sessionId: payload.activeSessionId,
        campaignId: payload.campaignId,
        title: 'Tavern Negotiation',
        type: 'social',
        status: 'ended',
        tags: ['social'],
        participants: [],
        segments: [{ startedAt: payload.now, endedAt: payload.now }],
        schemaVersion: 1,
        createdAt: payload.now,
        updatedAt: payload.now,
      });

      tx.objectStore('notes').add({
        id: payload.sessionNoteId,
        campaignId: payload.campaignId,
        sessionId: payload.activeSessionId,
        title: 'Seeded Session Note',
        body: null,
        type: 'generic',
        typeData: {},
        status: 'active',
        pinned: false,
        visibility: 'public',
        scope: 'campaign',
        schemaVersion: 1,
        createdAt: payload.now,
        updatedAt: payload.now,
      });

      tx.objectStore('notes').add({
        id: payload.encounterNoteId,
        campaignId: payload.campaignId,
        sessionId: payload.activeSessionId,
        title: 'Seeded Encounter Note',
        body: null,
        type: 'generic',
        typeData: {},
        status: 'active',
        pinned: false,
        visibility: 'public',
        scope: 'campaign',
        schemaVersion: 1,
        createdAt: payload.now,
        updatedAt: payload.now,
      });

      tx.objectStore('entityLinks').add({
        id: 'link-session-note',
        fromEntityId: payload.activeSessionId,
        fromEntityType: 'session',
        toEntityId: payload.sessionNoteId,
        toEntityType: 'note',
        relationshipType: 'contains',
        schemaVersion: 1,
        createdAt: payload.now,
        updatedAt: payload.now,
      });

      tx.objectStore('entityLinks').add({
        id: 'link-session-enc-note',
        fromEntityId: payload.activeSessionId,
        fromEntityType: 'session',
        toEntityId: payload.encounterNoteId,
        toEntityType: 'note',
        relationshipType: 'contains',
        schemaVersion: 1,
        createdAt: payload.now,
        updatedAt: payload.now,
      });

      tx.objectStore('entityLinks').add({
        id: 'link-encounter-note',
        fromEntityId: payload.activeEncounterId,
        fromEntityType: 'encounter',
        toEntityId: payload.encounterNoteId,
        toEntityType: 'note',
        relationshipType: 'contains',
        schemaVersion: 1,
        createdAt: payload.now,
        updatedAt: payload.now,
      });

      tx.objectStore('kb_nodes').add({
        id: payload.timelineNodeId,
        type: 'note',
        label: 'Seeded Session Note',
        scope: 'campaign',
        campaignId: payload.campaignId,
        sourceId: payload.sessionNoteId,
        createdAt: payload.now,
        updatedAt: payload.now,
      });

      tx.objectStore('kb_nodes').add({
        id: payload.encounterNodeId,
        type: 'note',
        label: 'Seeded Encounter Note',
        scope: 'campaign',
        campaignId: payload.campaignId,
        sourceId: payload.encounterNoteId,
        createdAt: payload.now,
        updatedAt: payload.now,
      });
    });

    db.close();
  }, seed);
}

async function expectTextVisible(locator) {
  await locator.waitFor({ state: 'visible', timeout: 10000 });
}

async function fillQuickNote(page) {
  await page.getByRole('button', { name: 'Add Note' }).click();
  await page.getByRole('heading', { name: 'Quick Note' }).waitFor({ state: 'visible' });
  await page.getByPlaceholder('Title (optional)').fill('Playwright Quick Note');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByPlaceholder('Title (optional)').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.body.innerText.includes('Playwright Quick Note'));
}

async function fillQuickNpc(page) {
  await page.getByRole('button', { name: 'NPC / Monster' }).click();
  await page.getByRole('heading', { name: 'NPC / Monster' }).waitFor({ state: 'visible' });
  await page.getByPlaceholder('e.g. Drunk Patron').fill('Playwright NPC');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByPlaceholder('e.g. Drunk Patron').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.body.innerText.includes('Playwright NPC'));
}

async function testEncounterLogger(page) {
  await page.getByRole('button', { name: 'Encounter', exact: true }).click();
  await page.getByRole('heading', { name: 'Random Encounter' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Log Random Encounter' }).click();
  await page.getByRole('button', { name: 'Log Random Encounter' }).waitFor({ state: 'hidden' });
}

async function testQuoteLogger(page) {
  await page.getByRole('button', { name: 'Quote' }).click();
  await page.getByRole('heading', { name: 'Quick Quote' }).waitFor({ state: 'visible' });
  await page.getByPlaceholder('What did they say?').fill('We should have brought a bigger torch.');
  await page.getByRole('button', { name: 'Log Quote' }).click();
  await page.getByRole('heading', { name: 'Quick Quote' }).waitFor({ state: 'hidden' });
}

async function testSkillLogger(page) {
  await page.getByRole('button', { name: 'Skill Check' }).click();
  await page.getByRole('heading', { name: 'Skill Check' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'ACROBATICS' }).click();
  await page.getByRole('button', { name: 'Success' }).click();
  await page.getByRole('heading', { name: 'Skill Check' }).waitFor({ state: 'hidden' });
}

async function openMoreMenu(page) {
  await page.getByRole('button', { name: 'More' }).click();
}

async function testSecondaryActions(page) {
  await openMoreMenu(page);
  await page.getByRole('menuitem', { name: 'Cast Spell' }).click();
  await page.getByRole('heading', { name: 'Cast Spell' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Close' }).click();

  await openMoreMenu(page);
  await page.getByRole('menuitem', { name: 'Ability' }).click();
  await page.getByRole('heading', { name: 'Heroic Ability' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Close' }).click();

  await openMoreMenu(page);
  await page.getByRole('menuitem', { name: 'Condition' }).click();
  await page.getByRole('heading', { name: 'Condition' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '+ Exhausted (STR)' }).click();
  await page.getByRole('heading', { name: 'Condition' }).waitFor({ state: 'hidden' });

  await openMoreMenu(page);
  await page.getByRole('menuitem', { name: 'Death Roll' }).click();
  await page.getByRole('heading', { name: 'Death Roll' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Survived', exact: true }).click();
  await page.getByRole('button', { name: 'Survived', exact: true }).waitFor({ state: 'hidden' });

  await openMoreMenu(page);
  await page.getByRole('menuitem', { name: 'Rest' }).click();
  await page.getByRole('heading', { name: 'Rest' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Round Rest Recover D6 WP' }).click();
  await page.getByRole('button', { name: 'Round Rest Recover D6 WP' }).waitFor({ state: 'hidden' });

  await openMoreMenu(page);
  await page.getByRole('menuitem', { name: 'Camp' }).click();
  await page.getByRole('heading', { name: 'Camp' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Make Camp Set up camp for the shift' }).click();
  await page.getByRole('button', { name: 'Make Camp Set up camp for the shift' }).waitFor({ state: 'hidden' });

  await openMoreMenu(page);
  await page.getByRole('menuitem', { name: 'Travel' }).click();
  await page.getByRole('heading', { name: 'Travel' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '1 shift', exact: true }).click();
  await page.getByRole('button', { name: '1 shift', exact: true }).waitFor({ state: 'hidden' });

  await openMoreMenu(page);
  await page.getByRole('menuitem', { name: 'Rumor' }).click();
  await page.getByRole('heading', { name: 'Rumor Heard' }).waitFor({ state: 'visible' });
  await page.getByPlaceholder("What's the rumor?").fill('A hidden vault lies beneath the mill.');
  await page.getByRole('button', { name: 'Log Rumor' }).click();
  await page.getByRole('heading', { name: 'Rumor Heard' }).waitFor({ state: 'hidden' });

  await openMoreMenu(page);
  await page.getByRole('menuitem', { name: 'Shopping' }).click();
  await page.getByRole('heading', { name: 'Shopping' }).waitFor({ state: 'visible' });
  await page.getByPlaceholder('Item name (optional)').fill('Lantern oil');
  await page.getByRole('button', { name: 'Log Purchase' }).click();
  await page.getByRole('heading', { name: 'Shopping' }).waitFor({ state: 'hidden' });

  await openMoreMenu(page);
  await page.getByRole('menuitem', { name: 'Loot' }).click();
  await page.getByRole('heading', { name: 'Loot Found' }).waitFor({ state: 'visible' });
  await page.getByPlaceholder('What did you find?').fill('Silver key');
  await page.getByRole('button', { name: 'Log Loot' }).click();
  await page.getByRole('heading', { name: 'Loot Found' }).waitFor({ state: 'hidden' });
}

async function testSessionMenu(page) {
  await page.getByRole('button', { name: 'Session actions' }).click();
  await expectTextVisible(page.getByText('Export Session Markdown', { exact: true }));
  await expectTextVisible(page.getByText('Export Notes ZIP', { exact: true }));
  await expectTextVisible(page.getByText('Export .skaldbok', { exact: true }));
  await page.keyboard.press('Escape');
}

async function testEndSessionCancel(page) {
  await page.getByRole('button', { name: 'End Session' }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
}

async function testBestiaryNavigation(page) {
  await page.getByRole('button', { name: 'Bestiary' }).click();
  await page.waitForURL(/\/bestiary$/);
  await page.getByRole('link', { name: 'Session' }).click();
  await page.waitForURL(/\/session$/);
}

async function testSessionNotesTools(page) {
  await page.getByPlaceholder('Search notes, characters, locations...').fill('Playwright Quick Note');
  await page.waitForFunction(() => document.body.innerText.includes('Playwright Quick Note'));
  await page.getByRole('button', { name: 'Open Knowledge Base →' }).click();
  await page.waitForURL(/\/kb$/);
  await page.getByRole('link', { name: 'Session' }).click();
  await page.waitForURL(/\/session$/);
}

async function testTimelineButtons(page) {
  await page.getByRole('button', { name: 'Open Active Encounter' }).click();
  await page.getByRole('heading', { name: 'Goblin Ambush', level: 1 }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Back' }).first().click();
  await page.getByRole('heading', { name: 'Session Active' }).waitFor({ state: 'visible' });

  await page.getByRole('button', { name: 'Start Encounter' }).click();
  await page.getByRole('dialog', { name: 'Start encounter' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('dialog', { name: 'Start encounter' }).waitFor({ state: 'hidden' });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];

  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !shouldIgnoreConsoleError(msg.text())) {
      errors.push(`console error: ${msg.text()}`);
    }
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await seedSessionState(page);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('link', { name: 'Session' }).click();
    await page.waitForURL(/\/session$/);

    await expectTextVisible(page.getByRole('heading', { name: 'Playwright Campaign' }));
    await expectTextVisible(page.getByRole('heading', { name: 'Session Active' }));
    await expectTextVisible(page.getByText('Seeded Session Note', { exact: true }).first());

    await testBestiaryNavigation(page);
    await testSessionMenu(page);
    await testEndSessionCancel(page);
    await fillQuickNote(page);
    await fillQuickNpc(page);
    await testEncounterLogger(page);
    await testQuoteLogger(page);
    await testSkillLogger(page);
    await testSecondaryActions(page);
    await testSessionNotesTools(page);
    await testTimelineButtons(page);

    if (errors.length > 0) {
      throw new Error(errors.join('\n'));
    }

    console.log('SESSION_SMOKE_PASS');
  } finally {
    await page.screenshot({ path: 'output/playwright/session-smoke-final.png', fullPage: true }).catch(() => {});
    await browser.close();
  }
}

main().catch((error) => {
  console.error('SESSION_SMOKE_FAIL');
  console.error(error);
  process.exitCode = 1;
});
