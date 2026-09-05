const origin = "https://joemechu.com";

const pages = ["", "/guide", "/about", "/contact", "/privacy", "/terms"];

export function GET() {
  const urls = pages
    .map((path) => `  <url><loc>${origin}${path || "/"}</loc></url>`)
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
