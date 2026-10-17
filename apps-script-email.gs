/*************************************************************
 *  INDIANA RESTAURANT & CAFE — EMAIL AUTOMATION (FREE, NO CARD)
 *  v2
 *  ---------------------------------------------------------
 *  TOTAL 3 TARAH KE EMAIL:
 *
 *   1) Guest booking karta hai
 *        -> GUEST  : "Booking request received"  (pending confirmation)
 *        -> OWNER  : "New booking" alert + WhatsApp button
 *
 *   2) Owner admin me CONFIRM / CANCEL dabata hai
 *        -> GUEST  : "Table confirmed"  ya  "Booking cancelled"
 *
 *   3) Menu se naya order aata hai
 *        -> OWNER  : "New order" alert
 *
 *  Setup steps: EMAIL-SETUP-2026.txt
 *************************************************************/

/* ============ YE 2 LINES PEHLE SE BHARI HUI HAIN ============ */
const OWNER_EMAIL = '2011navmansh@gmail.com';   // owner ka Gmail
const KEY = '2011';                             // webhook key (?key=2011)
/* ============================================================ */

const SHEET_TAB = 'Bookings';
const SITE = 'https://indianarestaurantandcafejwr.dpdns.org';
const PHONE = '+91 90579 67791';
const ADDRESS = 'Rajlaxmi Nagar, Jhalawar, Rajasthan 326001';
const MAPS = 'https://www.google.com/maps?q=24.587048235784344,76.17682239644377';


/* ---------------- HTTP entry points ---------------- */

function doGet(e) {
  if ((e.parameter.key || '') !== KEY) return json_({ ok: false, error: 'bad key' });
  if (e.parameter.test) {
    MailApp.sendEmail({
      to: OWNER_EMAIL,
      name: 'Indiana Website',
      subject: 'Indiana — email service test',
      htmlBody: wrap_('Email service is working',
        '<p>This is a test message. New bookings, orders and guest emails will go out from here.</p>')
    });
    return json_({ ok: true, test: 'sent to ' + OWNER_EMAIL });
  }
  return json_({ ok: true, service: 'indiana-mail', v: 2, hint: 'add &test=1 to send a test email' });
}

function doPost(e) {
  try {
    if ((e.parameter.key || '') !== KEY) return json_({ ok: false, error: 'bad key' });

    const data = JSON.parse((e.postData && e.postData.contents) || '{}');
    const type = data.type || 'booking';

    /* ---------- 1. NAYI BOOKING -> guest + owner ---------- */
    if (type === 'booking') {
      const b = data.booking || {};
      row_(['NEW BOOKING', b.id, b.date, b.time, b.guests, b.name, b.phone, b.email, 'pending', b.notes, b.createdAt]);
      guestReceived_(b);                              // guest ko turant
      ownerNewBooking_(b);                            // owner ko alert
      return json_({ ok: true, type: type, id: b.id, guestMail: b.email ? 'sent' : 'no-email' });
    }

    /* ---------- 2. CONFIRM / CANCEL -> guest ---------- */
    if (type === 'status') {
      const b = data.booking || {};
      row_(['STATUS: ' + b.status, b.id, b.date, b.time, b.guests, b.name, b.phone, b.email, b.status, b.notes, b.updatedAt || b.createdAt]);
      if (b.email) guestStatus_(b);
      return json_({ ok: true, type: type, id: b.id, guestMail: b.email ? 'sent' : 'no-email-on-booking' });
    }

    /* ---------- 3. NAYA ORDER -> owner ---------- */
    if (type === 'order') {
      const o = data.order || {};
      const items = (o.items || [])
        .map(function (i) { return i.qty + 'x ' + i.name + ' &nbsp;<b>Rs ' + (i.qty * i.price) + '</b>'; })
        .join('<br>');
      row_(['NEW ORDER', o.id, '', '', '', o.name, o.phone, '', 'new',
        (o.items || []).map(function (i) { return i.qty + 'x ' + i.name; }).join(', '), o.createdAt]);
      MailApp.sendEmail({
        to: OWNER_EMAIL, name: 'Indiana Website',
        subject: 'New order ' + o.id + ' — Rs ' + o.total,
        htmlBody: wrap_('A new order has arrived',
          '<p style="font-size:16px"><b>' + esc_(o.name) + '</b> &nbsp;·&nbsp; ' + esc_(o.phone) + '</p>' +
          '<p style="font-size:15px;line-height:1.8">' + items + '</p>' +
          '<p style="font-size:20px;margin-top:18px"><b>Total: Rs ' + o.total + '</b></p>' +
          '<p>' + waLink_(o.phone, 'Hi ' + o.name + '! This is Indiana — we have received your order ' + o.id + '.') + '</p>')
      });
      return json_({ ok: true, type: type, id: o.id });
    }

    return json_({ ok: false, error: 'unknown type: ' + type });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}


/* ---------- EMAIL 1a — GUEST: request received (turant) ---------- */
function guestReceived_(b) {
  if (!b.email) return;

  const body =
    '<p>Hello ' + esc_(b.name) + ',</p>' +
    '<p>Thank you for choosing <b>Indiana Restaurant &amp; Cafe</b>. ' +
      'Your booking request has been received and is now with our team.</p>' +
    '<p style="margin-top:16px;font-size:15px"><b>Status: PENDING</b> &mdash; waiting for confirmation</p>' +
    '<table style="margin-top:14px;border-collapse:collapse;font-size:15px">' +
      row2_('Reference', b.id) +
      row2_('Date', b.date) +
      row2_('Time', b.time) +
      row2_('Guests', b.guests) +
      row2_('Seating', b.seating || 'indoor') +
      (b.occasion ? row2_('Occasion', b.occasion) : '') +
      (b.notes ? row2_('Your note', b.notes) : '') +
    '</table>' +
    '<p style="margin-top:18px">You will receive a <b>second email</b> as soon as your table is confirmed. ' +
      'This usually takes only a few minutes.</p>' +
    '<p>Need to change or cancel something? Simply reply to this email and we will take care of it.</p>' +
    '<p style="margin-top:18px"><b>Indiana Restaurant &amp; Cafe</b><br>' +
      ADDRESS + '<br>' + PHONE + '</p>' +
    '<p><a href="' + MAPS + '">View us on Google Maps</a></p>';

  MailApp.sendEmail({
    to: b.email, name: 'Indiana Restaurant & Cafe', replyTo: OWNER_EMAIL,
    subject: 'Booking request received — ' + b.id + ' (' + b.date + ' ' + b.time + ')',
    htmlBody: wrap_('Booking request received', body)
  });
}


/* ---------- EMAIL 1b — OWNER: new booking alert ---------- */
function ownerNewBooking_(b) {
  const body =
    '<p style="font-size:17px;margin:0 0 4px"><b>' + esc_(b.name) + '</b></p>' +
    '<p style="margin:0;color:#6b6255">' + esc_(b.phone) + (b.email ? ' &nbsp;·&nbsp; ' + esc_(b.email) : '') + '</p>' +
    '<table style="margin-top:16px;border-collapse:collapse;font-size:15px">' +
      row2_('Reference', b.id) +
      row2_('Date', b.date) +
      row2_('Time', b.time) +
      row2_('Guests', b.guests) +
      row2_('Seating', b.seating || 'indoor') +
      (b.occasion ? row2_('Occasion', b.occasion) : '') +
      (b.notes ? row2_('Notes', b.notes) : '') +
    '</table>' +
    '<p style="margin-top:20px">' +
      waLink_(b.phone, 'Hi ' + b.name + '! This is Indiana — we have received your booking ' + b.id + '.') +
    '</p>' +
    '<p style="margin-top:6px;font-size:13px;color:#6b6255">To confirm or cancel, open the admin console: ' +
      '<a href="' + SITE + '/admin.html">' + SITE + '/admin.html</a>' +
      ' &nbsp;(press CONFIRM and the guest gets an email automatically)</p>';

  MailApp.sendEmail({
    to: OWNER_EMAIL, name: 'Indiana Website',
    subject: 'New booking ' + b.id + ' — ' + b.date + ' ' + b.time + ', ' + b.guests + ' guests',
    htmlBody: wrap_('A new booking has arrived', body)
  });
}


/* ---------- EMAIL 2 — GUEST: confirmed / cancelled ---------- */
function guestStatus_(b) {
  const yes = (b.status === 'confirmed');
  const head = yes ? 'Your table is confirmed' : 'Your booking has been cancelled';

  const body =
    '<p>Hello ' + esc_(b.name) + ',</p>' +
    (yes
      ? '<p>Good news &mdash; your table at <b>Indiana Restaurant &amp; Cafe</b> is <b>confirmed</b>. We look forward to hosting you!</p>'
      : '<p>Your booking has been cancelled. If you would like another date or time, just reply to this email and we will set up a new table for you.</p>') +
    '<table style="margin-top:16px;border-collapse:collapse;font-size:15px">' +
      row2_('Reference', b.id) +
      row2_('Date', b.date) +
      row2_('Time', b.time) +
      row2_('Guests', b.guests) +
      (b.notes ? row2_('Your note', b.notes) : '') +
    '</table>' +
    '<p style="margin-top:18px"><b>Indiana Restaurant &amp; Cafe</b><br>' +
      ADDRESS + '<br>' + PHONE + '</p>' +
    '<p><a href="' + MAPS + '">Get directions on Google Maps</a></p>' +
    (yes ? '' : '<p style="margin-top:14px">Make a new booking: <a href="' + SITE + '/reserve.html">' + SITE + '/reserve.html</a></p>');

  MailApp.sendEmail({
    to: b.email, name: 'Indiana Restaurant & Cafe', replyTo: OWNER_EMAIL,
    subject: yes ? ('Table confirmed — ' + b.date + ' ' + b.time + ' (' + b.id + ')')
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
  return '<a href="https://wa.me/91' + d + '?text=' + encodeURIComponent(msg) + '">Message on WhatsApp</a>';
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
