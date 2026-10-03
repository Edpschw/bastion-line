#!/usr/bin/env python3
"""Enxuga um .glb: mantém só as animações listadas e descarta dos buffers os
dados que ninguém mais referencia (as faixas de animação são a maior parte do
peso dos personagens KayKit, que trazem ~80 clipes cada).

Uso: strip_glb_anims.py entrada.glb saida.glb Idle Walking_A Death_A ...
"""
import json, struct, sys

def main(src, dst, keep):
    b = open(src, 'rb').read()
    assert b[:4] == b'glTF'
    jlen = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jlen])
    off = 20 + jlen
    blen = struct.unpack('<I', b[off:off + 4])[0]
    binbuf = b[off + 8:off + 8 + blen]

    def short(name):
        return name.split('|')[-1]
    j['animations'] = [a for a in j.get('animations', []) if short(a['name']) in keep]

    used_acc = set()
    for m in j.get('meshes', []):
        for p in m['primitives']:
            used_acc.update(p['attributes'].values())
            if 'indices' in p: used_acc.add(p['indices'])
            for t in p.get('targets', []): used_acc.update(t.values())
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s: used_acc.add(s['inverseBindMatrices'])
    for a in j['animations']:
        for s in a['samplers']: used_acc.update((s['input'], s['output']))

    acc_map = {old: new for new, old in enumerate(sorted(used_acc))}
    accessors = [j['accessors'][i] for i in sorted(used_acc)]
    used_bv = {a['bufferView'] for a in accessors if 'bufferView' in a}
    used_bv.update(img['bufferView'] for img in j.get('images', []) if 'bufferView' in img)
    bv_map, views, out = {}, [], bytearray()
    for new, old in enumerate(sorted(used_bv)):
        v = dict(j['bufferViews'][old])
        while len(out) % 4: out.append(0)
        start = v.get('byteOffset', 0)
        out += binbuf[start:start + v['byteLength']]
        v['byteOffset'] = len(out) - v['byteLength']
        bv_map[old] = new; views.append(v)
    while len(out) % 4: out.append(0)

    for a in accessors:
        if 'bufferView' in a: a['bufferView'] = bv_map[a['bufferView']]
    for img in j.get('images', []):
        if 'bufferView' in img: img['bufferView'] = bv_map[img['bufferView']]
    for m in j.get('meshes', []):
        for p in m['primitives']:
            p['attributes'] = {k: acc_map[v] for k, v in p['attributes'].items()}
            if 'indices' in p: p['indices'] = acc_map[p['indices']]
            if 'targets' in p: p['targets'] = [{k: acc_map[v] for k, v in t.items()} for t in p['targets']]
    for s in j.get('skins', []):
        if 'inverseBindMatrices' in s: s['inverseBindMatrices'] = acc_map[s['inverseBindMatrices']]
    for a in j['animations']:
        for s in a['samplers']:
            s['input'] = acc_map[s['input']]; s['output'] = acc_map[s['output']]
    j['accessors'] = accessors; j['bufferViews'] = views
    j['buffers'] = [{'byteLength': len(out)}]

    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(out)
    with open(dst, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(js), b'JSON')); f.write(js)
        f.write(struct.pack('<I4s', len(out), b'BIN\x00')); f.write(out)
    print(f'{src} -> {dst}: {len(b)//1024} KB -> {total//1024} KB, {len(j["animations"])} clipes')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], set(sys.argv[3:]))
