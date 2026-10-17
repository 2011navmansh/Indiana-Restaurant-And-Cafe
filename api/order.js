export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { name, phone, items, total } = req.body || {};
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Cart empty' });
    const order = {
      id: Date.now().toString(36),
      name: String(name || 'Guest').slice(0, 80),
      phone: String(phone || '').slice(0, 20),
      items: items.slice(0, 20),
      total: Number(total) || 0,
      createdAt: new Date().toISOString(),
    };
    const sheetUrl = process.env.GOOGLE_SHEET_URL_ORDERS || process.env.GOOGLE_SHEET_URL;
    if (sheetUrl) {
      try { await fetch(sheetUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'order', ...order }) }); } catch (e) { console.warn(e.message); }
    }
    const resendKey = process.env.RESEND_API_KEY;
    const notifyEmail = process.env.NOTIFY_EMAIL;
    if (resendKey && notifyEmail) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Indiana <onboarding@resend.dev>',
            to: [notifyEmail],
            subject: `New Order: ${order.name} - Rs.${order.total}`,
            html: `<h2>New Order</h2><p><b>Name:</b> ${order.name}</p><p><b>Phone:</b> ${order.phone}</p><p>${order.items.map(i => `${i.name} x${i.qty} - Rs.${i.price * i.qty}`).join('<br>')}</p><p><b>Total: Rs.${order.total}</b></p>`,
          }),
        });
      } catch (e) { console.warn(e.message); }
    }
    const msg = encodeURIComponent(`Hi Indiana! New Order:\n${order.items.map(i => `${i.name} x${i.qty} - Rs.${i.price * i.qty}`).join('\n')}\nTotal: Rs.${order.total}\nName: ${order.name}\nPhone: ${order.phone}`);
    return res.status(200).json({ ok: true, order, wa: `https://wa.me/919057967791?text=${msg}` });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
}
