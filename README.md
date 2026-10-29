# Ärïes

Minha página pessoal de links, no estilo guns.lol.

- `index.html`: a página inteira (foto, fundo, capa e ícones já vão embutidos).
- `musica.mp3`: a música do player (já cortada pra começar no 1:38). `assets/previa.mp3`: prévia abafada da tela de entrada. `assets/furo-*.png`: furos de bala do tiro. `icon.png` / `apple-icon.png`: ícone da aba e da tela inicial.
- Pra mudar nome, links, música ou o segundo em que ela começa, edite o bloco `CONFIG` no começo do `<script>`.
- Status do Discord ao vivo usa o Lanyard: precisa estar no servidor discord.gg/lanyard.

## Publicação
Ligado à Cloudflare (Worker `ariesdasilva`). Todo push na branch `main` publica sozinho.
Comando de deploy na Cloudflare: `npx wrangler deploy`.

## Painel secreto
`Ctrl+Alt+D` no site abre o painel de visitas (pede senha). O registro fica em `worker.js` (Durable Object com SQLite na Cloudflare).
A senha não está no repositório: em `wrangler.jsonc` fica só o SHA-256 dela (`PANEL_HASH`).
