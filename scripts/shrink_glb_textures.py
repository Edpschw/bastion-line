#!/usr/bin/env python3
"""Reduz as texturas embutidas de um .glb (via `sips`, do macOS) e regrava o
binário. Pensado para os modelos de natureza, que trazem PNGs de 1–3 MB para
árvores que, na câmera do jogo, ocupam poucas centenas de pixels.

Uso: shrink_glb_textures.py entrada.glb saida.glb [lado_max=512]
"""
import json, os, struct, subprocess, sys, tempfile

def main(src, dst, side=512):
    b = open(src, 'rb').read()
    jlen = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jlen])
    off = 20 + jlen
    blen = struct.unpack('<I', b[off:off + 4])[0]
    binbuf = b[off + 8:off + 8 + blen]
    views = [bytes(binbuf[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]) for v in j['bufferViews']]
    for img in j.get('images', []):
        if 'bufferView' not in img: continue
        ext = '.png' if img.get('mimeType', 'image/png') == 'image/png' else '.jpg'
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'img' + ext)
            open(p, 'wb').write(views[img['bufferView']])
            subprocess.run(['sips', '-Z', str(side), p], check=True, capture_output=True)
            views[img['bufferView']] = open(p, 'rb').read()
    out = bytearray()
    for v, data in zip(j['bufferViews'], views):
        while len(out) % 4: out.append(0)
        v['byteOffset'] = len(out); v['byteLength'] = len(data); v['buffer'] = 0
        out += data
    while len(out) % 4: out.append(0)
    j['buffers'] = [{'byteLength': len(out)}]
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(out)
    with open(dst, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(js), b'JSON')); f.write(js)
        f.write(struct.pack('<I4s', len(out), b'BIN\x00')); f.write(out)
    print(f'{os.path.basename(src)}: {len(b)//1024} KB -> {total//1024} KB')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 512)
