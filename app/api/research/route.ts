import { getSession, upsertResearchContext } from '@/lib/store';
import { bad, json, readJson, s, verifiedVisitor } from '@/lib/http';

export const runtime = 'nodejs';

const INST = ['university', 'biotech', 'cro', 'independent_lab', 'other'];
const SCALE = ['single_vial', 'small_batch', 'bulk'];

export async function POST(req: Request) {
  const visitor = await verifiedVisitor();
  const b = await readJson<Record<string, unknown>>(req);
  const session = b?.sessionId ? await getSession(s(b.sessionId, 40)) : undefined;
  if (!visitor || !session || session.visitor_id !== visitor) return bad('Session not found.', 404);

  const inst = s(b!.institution_type, 30);
  const scale = s(b!.quantity_scale, 30);
  await upsertResearchContext(session.id, {
    institution_type: INST.includes(inst) ? inst : undefined,
    research_area: s(b!.research_area, 200) || undefined,
    quantity_scale: SCALE.includes(scale) ? scale : undefined,
    compounds: Array.isArray(b!.compounds) ? b!.compounds.map((c) => s(c, 120)).filter(Boolean) : undefined,
    coa_required: typeof b!.coa_required === 'boolean' ? b!.coa_required : undefined,
  });
  return json({ ok: true });
}
