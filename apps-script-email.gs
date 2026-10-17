/*************************************************************
 *  INDIANA RESTAURANT & CAFE — EMAIL AUTOMATION (FREE, NO CARD)
 *  ---------------------------------------------------------
 *  Ye Google Apps Script hai. Cloudflare Worker ("indiana-api")
 *  har booking / status change pe isko POST karta hai.
 *
 *  Kaam kya karta hai:
 *   1. NAYI BOOKING        -> owner ko email (naam, phone, date, time, guests, notes)
 *   2. OWNER CONFIRM/CANCEL-> GUEST ko email (confirmation / cancellation)
 *   3. NAYA ORDER          -> owner ko email
 *   4. (Optional) sab rows Google Sheet me bhi save
 *
 *  Setup steps: EMAIL-SETUP-2026.txt padho.
 *************************************************************/

/* ============ YAHAN 2 CHEEZEIN BADLO ============ */
const OWNER_EMAIL = 'apna-email@gmail.com';   // <-- apna Gmail address
const KEY = 'indiana-change-this-key';        // <-- koi bhi random word
/* ================================================ */

const SHEET_TAB = 'Bookings';                 // optional sheet tab ka naam
const SITE = 'https://indianarestaurantandcafejwr.dpdns.org';
const PHONE = '+91 90579 67791';
const ADDRESS = 'Rajlaxmi Nagar, Jhalawar, Rajasthan 326001';
const MAPS = 'https://www.google.com/maps?q=24.587048235784344,76.17682239644377';


/* ---------------- HTTP entry points ---------------- */

// Browser me kholo:  <web-app-URL>?key=KEY&test=1   -> test email aayega
function doGet(e) {
  if ((e.parameter.key || '') !== KEY) return json_({ ok: false, error: 'bad key' });
  if (e.parameter.test) {
    MailApp.sendEmail({
      to: OWNER_EMAIL,
      name: 'Indiana Website',
      subject: 'Indiana — email service test ✓',
      htmlBody: wrap_('Email service chal rahi hai ✓',
        '<p>Ye ek test message hai. Ab har nayi booking, naya order aur guest confirmation email isi se jayegi.</p>')
    });
    return json_({ ok: true, test: 'sent to ' + OWNER_EMAIL });
  }
  return json_({ ok: true, service: 'indiana-mail', hint: 'URL ke aage &test=1 lagao -> test email' });
}

function doPost(e) {
  try {
    if ((e.parameter.key || '') !== KEY) return json_({ ok: false, error: 'bad key' });

    const data = JSON.parse((e.postData && e.postData.contents) || '{}');
    const type = data.type || 'booking';

    /* ---------- 1. nayi booking -> owner ko ---------- */
    if (type === 'booking') {
      const b = data.booking || {};
      row_(['NEW BOOKING', b.id, b.date, b.time, b.guests, b.name, b.phone, b.email, 'pending', b.notes, b.createdAt]);
      ownerNewBooking_(b);
      return json_({ ok: true, type: type, id: b.id });
    }

    /* ---------- 2. owner ne CONFIRM / CANCEL dabaya -> guest ko ---------- */
    if (type === 'status') {
      const b = data.booking || {};
      row_(['STATUS: ' + b.status, b.id, b.date, b.time, b.guests, b.name, b.phone, b.email, b.status, b.notes, b.updatedAt || b.createdAt]);
      if (b.email) guestStatus_(b);
      return json_({ ok: true, type: type, id: b.id, guestMail: b.email ? 'sent' : 'no-email-on-booking' });
    }

    /* ---------- 3. naya order -> owner ko ---------- */
    if (type === 'order') {
      const o = data.order || {};
      const items = (o.items || [])
        .map(function (i) { return i.qty + 'x ' + i.name + ' &nbsp;<b>Rs ' + (i.qty * i.price) + '</b>'; })
        .join('<br>');
      row_(['NEW ORDER', o.id, '', '', '', o.name, o.phone, '', 'new',
        (o.items || []).map(function (i) { return i.qty + 'x ' + i.name; }).join(', '), o.createdAt]);
      MailApp.sendEmail({
        to: OWNER_EMAIL, name: 'Indiana Website',
        subject: '🛎️ Naya order ' + o.id + ' — Rs ' + o.total,
        htmlBody: wrap_('Naya order aa gaya',
          '<p style="font-size:16px"><b>' + esc_(o.name) + '</b> &nbsp;·&nbsp; ' + esc_(o.phone) + '</p>' +
          '<p style="font-size:15px;line-height:1.8">' + items + '</p>' +
          '<p style="font-size:20px;margin-top:18px"><b>Total: Rs ' + o.total + '</b></p>' +
          '<p>' + waLink_(o.phone, 'Hi ' + o.name + '! Indiana se — aapka order ' + o.id + ' mil gaya hai.') + '</p>')
      });
      return json_({ ok: true, type: type, id: o.id });
    }

    return json_({ ok: false, error: 'unknown type: ' + type });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}


/* ---------------- owner: nayi booking ---------------- */
function ownerNewBooking_(b) {
  const body =
    '<p style="font-size:17px;margin:0 0 4px"><b>' + esc_(b.name) + '</b></p>' +
    '<p style="margin:0;color:#6b6255">' + esc_(b.phone) + (b.email ? ' &nbsp;·&nbsp; ' + esc_(b.email) : '') + '</p>' +
    '<table style="margin-top:16px;border-collapse:collapse;font-size:15px">' +
      row2_('Reference', b.id) +
      row2_('Date', b.date) +
      row2_('Time', b.time) +
      row2_('Guests', b.guests) +
      row2_((b.seating === 'outdoor' ? 'Seating' : 'Seating'), b.seating || 'indoor') +
      (b.occasion ? row2_('Occasion', b.occasion) : '') +
      (b.notes ? row2_('Notes', b.notes) : '') +
    '</table>' +
    '<p style="margin-top:20px">' +
      waLink_(b.phone, 'Hi ' + b.name + '! Indiana se — aapki booking ' + b.id + ' mil gayi hai.') +
    '</p>' +
    '<p style="margin-top:6px;font-size:13px;color:#6b6255">Confirm ya cancel karne ke liye admin console kholo: ' +
      '<a href="' + SITE + '/admin.html">' + SITE + '/admin.html</a>' +
      ' &nbsp;(CONFIRM dabao -> guest ko email chali jayegi)</p>';

  MailApp.sendEmail({
    to: OWNER_EMAIL, name: 'Indiana Website',
    subject: '📅 Naya booking ' + b.id + ' — ' + b.date + ' ' + b.time + ', ' + b.guests + ' guests',
    htmlBody: wrap_('Naya booking aa gaya', body)
  });
}


/* ---------------- guest: confirmed / cancelled ---------------- */
function guestStatus_(b) {
  const yes = (b.status === 'confirmed');
  const head = yes ? 'Aapki table confirm ho gayi ✓' : 'Aapki booking cancel kar di gayi hai';

  const body =
    '<p>Namaste ' + esc_(b.name) + ',</p>' +
    (yes
      ? '<p>Indiana Restaurant &amp; Cafe me aapki table <b>confirm</b> ho gayi hai. Hum aapka intezaar karenge!</p>'
      : '<p>Aapki booking humne cancel kar di hai. Koi galti ho gayi ho ya nayi date chahiye ho to bas is email ka reply kar do — hum turant table set kar denge.</p>') +
    '<table style="margin-top:16px;border-collapse:collapse;font-size:15px">' +
      row2_('Reference', b.id) +
      row2_('Date', b.date) +
      row2_('Time', b.time) +
      row2_('Guests', b.guests) +
      (b.notes ? row2_('Your note', b.notes) : '') +
    '</table>' +
    '<p style="margin-top:18px"><b>Indiana Restaurant &amp; Cafe</b><br>' +
      ADDRESS + '<br>' + PHONE + '</p>' +
    '<p><a href="' + MAPS + '">📍 Google Maps pe directions</a></p>' +
    (yes ? '' : '<p style="margin-top:14px">Nayi booking: <a href="' + SITE + '/reserve.html">' + SITE + '/reserve.html</a></p>');

  MailApp.sendEmail({
    to: b.email, name: 'Indiana Restaurant & Cafe', replyTo: OWNER_EMAIL,
    subject: yes ? ('✅ Table confirmed — ' + b.date + ' ' + b.time + ' (' + b.id + ')')
                 : ('Booking cancelled — ' + b.date + ' ' + b.time + ' (' + b.id + ')'),
    htmlBody: wrap_(head, body)
  });
}


/* ---------------- helpers ---------------- */
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/\n/g, '<br>');
}

function digits_(p) { return String(p || '').replace(/\D/g, '').slice(-10); }

function waLink_(phone, msg) {
  const d = digits_(phone);
  if (!d) return '';
  return '<a href="https://wa.me/91' + d + '?text=' + encodeURIComponent(msg) + '">💬 WhatsApp pe message karo</a>';
}

function row2_(k, v) {
  return '<tr>' +
    '<td style="padding:6px 14px 6px 0;color:#6b6255;white-space:nowrap">' + esc_(k) + '</td>' +
    '<td style="padding:6px 0"><b>' + esc_(v) + '</b></td>' +
  '</tr>';
}

function wrap_(title, bodyHtml) {
  return '' +
  '<div style="font-family:Georgia,Segoe UI,sans-serif;background:#f5efe4;padding:22px">' +
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e6dcc9">' +
      '<div style="background:#0f2f22;padding:18px 22px">' +
        '<div style="color:#e9c46a;font-size:11px;letter-spacing:.22em;font-weight:bold">INDIANA RESTAURANT &amp; CAFE</div>' +
        '<div style="color:#ffffff;font-size:22px;margin-top:6px">' + title + '</div>' +
      '</div>' +
      '<div style="padding:22px;color:#2b2620;font-size:15px;line-height:1.6">' + bodyHtml + '</div>' +
      '<div style="padding:14px 22px;background:#faf6ee;color:#6b6255;font-size:12px">' +
        ADDRESS + ' &nbsp;·&nbsp; ' + PHONE + ' &nbsp;·&nbsp; <a href="' + SITE + '">' + SITE.replace('https://', '') + '</a>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/* optional: Google Sheet me rows (script sheet se bound ho to) */
function row_(values) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    let sh = ss.getSheetByName(SHEET_TAB);
    if (!sh) {
      sh = ss.insertSheet(SHEET_TAB);
      sh.appendRow(['type', 'id', 'date', 'time', 'guests', 'name', 'phone', 'email', 'status', 'notes', 'at']);
      sh.setFrozenRows(1);
    }
    sh.appendRow(values);
  } catch (e) { /* sheet na ho to koi baat nahi */ }
}
