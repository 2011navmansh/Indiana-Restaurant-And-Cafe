export default async function handler(req, res) {
  const pw = req.headers['x-admin-pw'];
  if (pw !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
  // If using Google Sheets, fetch from sheet; else return empty (sheet is source of truth)
  const sheetUrl = process.env.GOOGLE_SHEET_URL;
  if (!sheetUrl) return res.json({ data: [], note: 'Set GOOGLE_SHEET_URL to see data' });
  try {
    const r = await fetch(sheetUrl + '?type=' + (req.query.type || 'bookings'));
    const data = await r.json();
    return res.json({ data: Array.isArray(data) ? data : [] });
  } catch (e) { return res.json({ data: [], error: e.message }); }
}
