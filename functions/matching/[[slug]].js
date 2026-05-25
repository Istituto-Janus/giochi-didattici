export async function onRequest(context) {
  const url = new URL(context.request.url);
  const slug = url.pathname.split('/').filter(Boolean).pop();
  const assetUrl = new URL('/matching/index.html', url.origin);
  const response = await context.env.ASSETS.fetch(assetUrl.toString());
  const html = await response.text();
  const injected = html.replace(
    '</head>',
    `<script>window.__SLUG__ = '${slug}';</script></head>`
  );
  return new Response(injected, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' }
  });
}
