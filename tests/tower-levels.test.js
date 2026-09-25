const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
const data = html.slice(html.indexOf('var UNIT_BASE='), html.indexOf('var ENEMY_BASE='));

function sourceOf(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, name + ' exists');
  const first = html.indexOf('{', start);
  let depth = 0;
  for (let i = first; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error('Unclosed function: ' + name);
}

const context = vm.createContext({});
vm.runInContext(data + '\n' + ['getBaseStats', 'visualTier', 'evolutionCost'].map(sourceOf).join('\n'), context);

assert.equal(Object.keys(context.UNIT_BASE).length, 8);
for (const type of Object.keys(context.UNIT_BASE)) {
  const branches = Object.keys(context.BRANCHES[type]);
  assert.equal(branches.length, 2, type + ' has two branches');
  for (const branch of branches) {
    let lastHp = 0;
    for (let level = 1; level <= 20; level++) {
      const u = { type, branch: level < 5 ? null : branch, level };
      const stats = context.getBaseStats(u);
      assert.ok(stats.hp > 0 && stats.dmg > 0 && stats.atkSpd > 0, `${type}/${branch} L${level}`);
      assert.ok(stats.hp >= lastHp, `${type}/${branch} HP progresses at L${level}`);
      lastHp = stats.hp;
      assert.ok(context.visualTier(level) >= 1 && context.visualTier(level) <= 5);
      if (level > 1) assert.ok(context.evolutionCost(u, level, branch) > 0);
    }
    for (const milestone of [10, 15, 20]) {
      assert.equal(context.getBaseStats({ type, branch, level: milestone }).name,
        context.TOWER_LEVELS[type][branch][milestone].name);
    }
  }
}
for (const [level, max] of [[1,1],[5,2],[10,3],[15,5],[20,7]]) {
  const branch = level === 1 ? null : 'senhor';
  assert.equal(context.getBaseStats({type:'necro',branch,level}).summon.max, max);
}
assert.equal(context.UNIT_BASE.trap.walkable, true);
console.log('Tower progression: 8 types × 2 branches × 20 levels OK');
