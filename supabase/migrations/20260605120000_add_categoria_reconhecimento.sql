-- Adiciona a categoria "Reconhecimento" ao enum de categorias de postagem do PanNews.
alter type categoria_post add value if not exists 'Reconhecimento';
