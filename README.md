# Ärïes

Minha página pessoal de links, no estilo guns.lol.

- `index.html`: a página inteira (foto, fundo, capa e ícones já vão embutidos).
- `musica.mp3`: a música do player. `icon.png` / `apple-icon.png`: ícone da aba e da tela inicial.
- Pra mudar nome, links, música ou o segundo em que ela começa, edite o bloco `CONFIG` no começo do `<script>`.
- Status do Discord ao vivo usa o Lanyard: precisa estar no servidor discord.gg/lanyard.

## Publicação
Ligado à Cloudflare (Worker `ariesdasilva`). Todo push na branch `main` publica sozinho.
Comando de deploy na Cloudflare: `npx wrangler deploy`.
