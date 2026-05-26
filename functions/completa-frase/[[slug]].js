export async function onRequest(context) {
  const url = new URL(context.request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  // parts = ['completa-frase', 'slug-del-esercizio']
  const slug = parts[1] || '';
  const assetUrl = new URL('/completa-frase/_index.html', url.origin);
  const response = await context.env.ASSETS.fetch(assetUrl.toString());
  const html = await response.text();
  const injected = html.replace(
    '</head>',
    `<script>window.__SLUG__ = '${slug}';<\/script></head>`
  );
  return new Response(injected, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' }
  });
}
