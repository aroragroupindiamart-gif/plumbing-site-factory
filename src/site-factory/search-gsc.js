async function search() {
  const q = encodeURIComponent('google search console "sitemap could not be read" new site');
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await res.text();
  const re = /<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    console.log(m[1].replace(/<[^>]+>/g, '').trim());
    console.log('---');
  }
}
search();
