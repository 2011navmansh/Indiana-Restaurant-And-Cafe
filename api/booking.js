export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, phone, date, guests, message } = req.body || {};
    if (!name || !phone || !date) {
      return res.status(400).json({ error: 'Name, phone, date required' });
    }
    const booking = {
      id: Date.now().toString(36),
      name: String(name).trim().slice(0, 80),
      phone: String(phone).trim().slice(0, 20),
      date: String(date).slice(0, 20),
      guests: String(guests || '2 Guests').slice(0, 20),
      message: String(message || '').slice(0, 300),
      createdAt: new Date().toISOString(),
    };

    // 1. Google Sheets (if env set) - fire and forget
    const sheetUrl = process.env.GOOGLE_SHEET_URL;
    if (sheetUrl) {
      try {
        await fetch(sheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(booking),
        });
      } catch (e) { console.warn('Sheet failed', e.message); }
    }

    // 2. Resend Email (if env set)
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
            subject: `New Booking: ${booking.name} - ${booking.date}`,
            html: `<h2>New Table Booking</h2><p><b>Name:</b> ${booking.name}</p><p><b>Phone:</b> ${booking.phone}</p><p><b>Date:</b> ${booking.date}</p><p><b>Guests:</b> ${booking.guests}</p><p><b>Time:</b> ${booking.createdAt}</p>`,
          }),
        });
      } catch (e) { console.warn('Email failed', e.message); }
    }

    // Always success - frontend will also open WhatsApp
    return res.status(200).json({ ok: true, booking, wa: `https://wa.me/919876543210?text=${encodeURIComponent(`Hi Indiana! Reserve table:\nName: ${booking.name}\nPhone: ${booking.phone}\nDate: ${booking.date}\nGuests: ${booking.guests}`)}` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
