/** Permite que a Maya seja exibida dentro do site winela.com.br (iframe). */
module.exports = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/(.*)", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self' https://winela.com.br https://*.winela.com.br https://winela.myshopify.com https://admin.shopify.com" }] }];
  },
};
