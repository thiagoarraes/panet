# Logos do PanPass

Marcas baixadas das paginas oficiais de cada servico e servidas localmente
(`/panpass-logos/*`, dentro do `img-src 'self'` do CSP) -- nunca hotlinked de
CDN de terceiro. Cada arquivo veio do proprio header/favicon publico do site
oficial, exatamente o uso a que esses assets se destinam.

| Arquivo | Origem |
|---|---|
| `adobe.png` | adobe.com/upp/img/favicons/favicon-180.png (apple-touch-icon) |
| `chatgpt.svg` | openai.com/favicon.svg |
| `magnific.svg` | media.magnific.com/magnific-favicons/favicon-dark.svg |
| `shutterstock.png` | shutterstock.com/assets/images/favicon/favicon.svg (PNG extraido do base64 embutido) |

Uso: identificacao do servico dentro de um cofre de credenciais interno (uso
nominativo/referencial -- mesmo padrao que 1Password/Bitwarden mostram o icone
oficial de cada conta). Nao ha alegacao de afiliacao ou patrocinio.

Envato nao tem arquivo aqui: usa o icone do pacote `react-icons/si` (Simple
Icons), ja vetorial e local -- ver `src/lib/panpassIcones.js`.

Adobe, ChatGPT/OpenAI, Slack, LinkedIn, Salesforce, Amazon e Canva foram
removidos do Simple Icons apos pedidos de retirada por direito de marca; por
isso Adobe e ChatGPT vieram direto do site oficial em vez do pacote.
