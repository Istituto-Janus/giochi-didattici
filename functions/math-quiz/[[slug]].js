export async function onRequest(context) {
  const url = new URL(context.request.url);
  const parts = url.pathname.replace(/^\/math-quiz\//, "").split("/");
  const slug = parts[0] || "";

  const html = await context.env.ASSETS.fetch(
    new Request(new URL("/math-quiz/_index.html", url.origin))
  );

  const original = await html.text();
  const injected = original.replace(
    "</head>",
    `<script>window.__SLUG__ = ${JSON.stringify(slug)};</script></head>`
  );

  return new Response(injected, {
    headers: { "Content-Type": "text/html;charset=UTF-8" },
  });
}
