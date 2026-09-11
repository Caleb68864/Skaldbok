import { z } from 'zod';

export type CampaignStatus = 'active' | 'archived';

export const campaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  system: z.string().default('classic-fantasy'),
  status: z.enum(['active', 'archived']),
  /**
   * The party this campaign is playing, when it has more than one live party to
   * choose between.
   *
   * @remarks
   * Read by `partyRepository.getPartyByCampaign`'s `preferPartyId`. Three UI
   * flows have written it since it was added and none of them was ever
   * consulted — the party came back as whichever row the `campaignId` index
   * yielded first.
   *
   * There was an `activeSessionId` beside it with **no writer and no reader**.
   * It survived the capability guard on a name collision: `NotesGrid` declares
   * an unrelated prop called `activeSessionId` and reads it, which is enough for
   * a corpus-wide name search — and `NotesGrid` is itself unmounted. The running
   * session is found by querying `sessionRepository.getActiveSession`, which is
   * where the answer actually lives.
   */
  activePartyId: z.string().optional(),
  activeCharacterMemberId: z.string().optional(),
  /**
   * The current in-world date, in the ruleset's own dating.
   *
   * @remarks
   * Lives on the campaign because more than one feature needs it: recurring
   * ship costs accrue against it, and the route schedule is measured in the
   * same dates. Optional and additive — a campaign without one simply accrues
   * nothing.
   */
  campaignDate: z.string().optional(),
  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
  softDeletedBy: z.string().optional(),
});

export type Campaign = z.infer<typeof campaignSchema>;
