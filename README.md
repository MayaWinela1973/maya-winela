# Maya — Sommelier Virtual Winela (v2)

- O catálogo é lido automaticamente de https://winela.com.br/products.json (atualiza a cada 1 hora).
  Produto novo, preço ou promoção na Shopify aparece na Maya sem mexer no código.
- Produtos esgotados não são recomendados.

## Publicar na Vercel
1. Suba esta pasta para um repositório novo no GitHub.
2. Na Vercel: Add New → Project → importe o repositório.
3. Em Environment Variables, crie `ANTHROPIC_API_KEY` com a sua chave (console.anthropic.com).
4. Deploy.
