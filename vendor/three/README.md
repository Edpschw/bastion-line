# three.js (vendorizado)

- Versão: **r169** (`three@0.169.0`), obtida do pacote oficial no registro npm.
- Arquivo: `three.module.min.js` — build ESM minificado (`build/three.module.min.js` do pacote).
- Licença: MIT, ver `LICENSE`.

O arquivo é versionado aqui de propósito: o jogo é publicado como HTML estático
(GitHub Pages) e não deve depender de CDN em tempo de execução.

Para atualizar:

```sh
curl -sSLo three.tgz https://registry.npmjs.org/three/-/three-<versao>.tgz
tar xzf three.tgz package/build/three.module.min.js package/LICENSE
cp package/build/three.module.min.js vendor/three/three.module.min.js
cp package/LICENSE vendor/three/LICENSE
```

## GLTFLoader

- `GLTFLoader.js` e `utils/BufferGeometryUtils.js` vêm do mesmo pacote `three@0.169.0`
  (`examples/jsm/loaders/GLTFLoader.js` e `examples/jsm/utils/BufferGeometryUtils.js`),
  com o único ajuste de trocar o import `'three'` pelo caminho relativo do build local.
- Licença: MIT, mesma do restante do three.js.
