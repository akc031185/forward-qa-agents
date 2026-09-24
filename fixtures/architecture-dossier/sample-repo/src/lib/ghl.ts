export async function upsertGhlContact(c: { email: string; name: string }) {
  const res = await fetch('https://services.leadconnectorhq.com/contacts/upsert', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GHL_API_KEY}`, Version: '2021-07-28' },
    body: JSON.stringify(c),
  });
  return res.ok;
}
