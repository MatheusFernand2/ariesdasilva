# Ärïes

Minha página pessoal de links, no estilo guns.lol.

- `index.html`: a página inteira (foto, fundo e ícones já vão embutidos).
- Pra mudar nome, bio, status, links ou a música, edite o bloco `CONFIG` no começo do `<script>`.
- **Música:** coloque um arquivo `musica.mp3` nesta pasta e ajuste `title` e `artist` em `CONFIG.music`. Sem o arquivo, o player some sozinho.

## Publicação
Ligado à Cloudflare (Worker `ariesdasilva`). Todo push na branch `main` publica sozinho.
Comando de deploy na Cloudflare: `npx wrangler deploy`.
