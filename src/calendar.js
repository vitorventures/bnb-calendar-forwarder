const ical = require('node-ical');

async function getUpcomingCheckouts(icalUrl, lookaheadDays) {
  const events = await ical.async.fromURL(icalUrl);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + lookaheadDays);

  const checkouts = [];

  for (const event of Object.values(events)) {
    if (event.type !== 'VEVENT') continue;

    const dtend = event.end;
    if (!dtend) continue;

    const checkoutDate = new Date(dtend);
    checkoutDate.setHours(0, 0, 0, 0);

    if (checkoutDate >= today && checkoutDate <= cutoff) {
      checkouts.push({
        date: checkoutDate,
        summary: event.summary || 'Reservation',
      });
    }
  }

  checkouts.sort((a, b) => a.date - b.date);
  return checkouts;
}

module.exports = { getUpcomingCheckouts };
