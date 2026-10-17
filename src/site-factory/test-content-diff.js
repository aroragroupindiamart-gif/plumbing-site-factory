async function compare() {
  const [h1, h2, h3] = await Promise.all([
    fetch('https://hongda-plumbing.aroragroup-indiamart.workers.dev/al/huntsville/drain-cleaning').then(r => r.text()),
    fetch('https://casablanca-plumbing.aroragroup-indiamart.workers.dev/al/huntsville/drain-cleaning').then(r => r.text()),
    fetch('https://probity-plumbing.aroragroup-indiamart.workers.dev/al/huntsville/drain-cleaning').then(r => r.text())
  ]);

  function getIntro(html) {
    const m = html.match(/<p style="color:#94a3b8;font-size:1.05rem;[^"]*">([\s\S]*?)<\/p>/);
    return m ? m[1] : '';
  }

  function getAbout(html) {
    const m = html.match(/<h2 style="font-size:1.6rem;[^"]*">[\s\S]*?<\/h2><p style="color:#94a3b8;line-height:1.8;[^"]*">([\s\S]*?)<\/p>/);
    return m ? m[1] : '';
  }

  console.log('--- INTRO COMPARISON ---');
  console.log('Hongda:\n', getIntro(h1));
  console.log('\nCasablanca:\n', getIntro(h2));
  console.log('\nProbity:\n', getIntro(h3));

  console.log('\n--- ABOUT COMPARISON ---');
  console.log('Hongda:\n', getAbout(h1));
  console.log('\nCasablanca:\n', getAbout(h2));
  console.log('\nProbity:\n', getAbout(h3));
}
compare();
