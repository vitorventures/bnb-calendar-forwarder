function formatCleaningSchedule(checkouts) {
  const updatedStr = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const header = `🧹 *Cleaning Schedule*\n_Updated: ${updatedStr}_\n`;

  if (checkouts.length === 0) {
    return `${header}\nNo upcoming checkouts in the next period.`;
  }

  const lines = checkouts.map((checkout) => {
    const dayStr = checkout.date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
    return `• ${dayStr} — checkout after 11am`;
  });

  return `${header}\n${lines.join('\n')}`;
}

module.exports = { formatCleaningSchedule };
