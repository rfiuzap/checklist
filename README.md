# P-Mentor Checklist

Checklists normais e de emergência do Tecnam P-Mentor, baseados no AFM E01-R08 (seções 3 e 4). Site estático (PWA): instalável no celular e funciona offline.

Demo: https://renatofiuza.com.br/checklist/

## Estrutura

- `public_html/` — o site completo (HTML, CSS, JS, `data/checklists.json`, ícones, service worker e `.htaccess` para HostGator).

## Rodar localmente

```bash
python -m http.server 8765 --directory public_html
```

Abra http://localhost:8765.

## Publicar (HostGator/cPanel)

Envie o conteúdo de `public_html/` para a subpasta desejada. Todos os caminhos são relativos. Ao alterar qualquer arquivo, incremente `VERSION` em `sw.js` para forçar a atualização do cache.

## Aviso

Material de apoio ao estudo. Não substitui o AFM/POH oficial da aeronave, que é a única referência válida para operação. O PDF do AFM não faz parte deste repositório.
