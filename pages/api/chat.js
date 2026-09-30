// Maya — Sommelier Virtual Winela
// O catálogo é lido AO VIVO da loja Shopify (winela.com.br/products.json),
// então nomes, preços, promoções e links estão sempre corretos — sem lista fixa para manter.

const STORE = "https://winela.com.br";
const CACHE_MS = 60 * 60 * 1000; // atualiza o catálogo a cada 1 hora
let cache = { text: "", at: 0, handles: [] };

// Garante que todo link de produto aponte para uma página que existe.
function fixLinks(text, handles) {
  return text.replace(/https?:\/\/(?:www\.)?winela\.com\.br\/products\/([a-z0-9\-]+)/gi, (full, slug) => {
    slug = slug.toLowerCase();
    if (handles.includes(slug)) return `${STORE}/products/${slug}`;
    const words = slug.split("-").filter((w) => w.length > 2);
    let best = null, bestScore = 0;
    for (const h of handles) {
      const score = words.filter((w) => h.includes(w)).length + (h.startsWith(slug) ? 5 : 0);
      if (score > bestScore) { best = h; bestScore = score; }
    }
    if (best && bestScore >= Math.min(2, words.length)) return `${STORE}/products/${best}`;
    return `${STORE}/search?q=${encodeURIComponent(words.join(" "))}&type=product`;
  });
}

const PERSONA = `Você é Maya, a sommelier virtual da Winela, loja especializada em vinhos brasileiros de alta qualidade.

Seu jeito é descontraído, acolhedor e acessível — você ama vinho e quer que todo mundo se sinta bem-vindo, do cliente que compra a primeira garrafa a quem já entende muito. Nada de ser intimidadora nem usar termos difíceis sem explicar.

REGRAS IMPORTANTES:
- Recomende APENAS produtos do CATÁLOGO abaixo, usando exatamente o link informado. Nunca invente produto, preço ou link.
- Se o cliente pedir algo que não existe no catálogo, diga que no momento a Winela não trabalha com essa opção e ofereça a alternativa mais próxima.
- Seja breve e objetiva. Máximo 3 recomendações por vez.
- Sempre mencione o preço. Se houver preço "de", destaque a promoção ("De R$ X por R$ Y").
- Ao recomendar, SEMPRE inclua o link em markdown: [Nome do produto](URL)
- Use emojis com moderação 🍷
- Quando não souber o que o cliente quer, faça 1 pergunta simples (tipo de vinho ou ocasião) e já recomende.
- Para presentes, prefira os kits de presente do catálogo.
- Frete: grátis para São Paulo capital; para o resto do Brasil, grátis acima de R$ 300. O valor exato aparece no checkout.

COMO APRESENTAR UM VINHO:
🍷 [Nome](URL)
Preço: R$ XX,XX
Perfil: breve descrição
Harmoniza com: sugestão

ACESSÓRIOS: ao final, sugira no máximo 1 acessório do catálogo que combine com a experiência do vinho (aerador, abridor, taças, decanter, rolha). Não sugira itens que fogem do papel de sommelier (ex.: kits de queijo, canetas marcadoras).`;

const clean = (html = "") =>
  html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 350);

const brl = (v) => "R$ " + Number(v).toFixed(2).replace(".", ",");

async function getCatalog() {
  if (cache.text && Date.now() - cache.at < CACHE_MS) return cache.text;
  const res = await fetch(`${STORE}/products.json?limit=250`);
  if (!res.ok) throw new Error("Falha ao ler catálogo: " + res.status);
  const { products } = await res.json();
  const lines = products
    .filter((p) => p.variants?.some((v) => v.available))
    .map((p) => {
      const v = p.variants.find((x) => x.available) || p.variants[0];
      const promo =
        v.compare_at_price && Number(v.compare_at_price) > Number(v.price)
          ? `De ${brl(v.compare_at_price)} por ${brl(v.price)}`
          : brl(v.price);
      const tags = (p.tags || []).map((t) => t.replace(/^#/, "")).join(", ");
      return `- [${p.title}](${STORE}/products/${p.handle}) | ${promo}${tags ? ` | tags: ${tags}` : ""}\n  ${clean(p.body_html)}`;
    });
  cache = { text: lines.join("\n"), at: Date.now(), handles: products.map((p) => p.handle) };
  return cache.text;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: "Messages array is required" });
  }

  const apiMessages = messages.filter((m, i) => !(i === 0 && m.role === "assistant")).slice(-20);

  try {
    const catalog = await getCatalog();
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: [
          { type: "text", text: PERSONA },
          { type: "text", text: "CATÁLOGO ATUAL DA WINELA:\n" + catalog, cache_control: { type: "ephemeral" } },
        ],
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("Anthropic API error:", err);
      return res.status(response.status).json({ error: err.error?.message || "API error" });
    }

    const data = await response.json();
    const text = fixLinks(data.content?.map((b) => b.text || "").join("") || "", cache.handles);
    return res.status(200).json({ text });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
