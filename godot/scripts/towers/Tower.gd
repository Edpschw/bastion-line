class_name Tower
extends Node2D
## Torre genérica. Stats e árvore de evolução vêm de data/towers/towers.json.

signal changed(tower: Tower)

enum TargetMode { FIRST, LAST, CLOSEST, STRONGEST }

var tower_id: String = ""
var node_id: String = ""
var stats: Dictionary = {}
var invested_gold: int = 0
var target_mode: int = TargetMode.FIRST
var show_range: bool = false

var _cooldown: float = 0.0
var _flash: float = 0.0
var _base_color: Color = Color.WHITE


func setup(id: String) -> void:
	tower_id = id
	var def := GameData.tower(id)
	if def.is_empty():
		push_error("Tower: tipo desconhecido '%s'" % id)
		queue_free()
		return
	_base_color = Color.html(str(def.get("color", "#d9992f")))
	invested_gold = int(def.get("cost", 0))
	_apply_node(str(def.get("root", "")))
	add_to_group("towers")


func _apply_node(new_node_id: String) -> void:
	var node_stats := GameData.tower_node(tower_id, new_node_id)
	if node_stats.is_empty():
		push_error("Tower: no de evolucao desconhecido '%s'" % new_node_id)
		return
	node_id = new_node_id
	stats = node_stats
	_cooldown = 0.0
	queue_redraw()
	changed.emit(self)


func display_name() -> String:
	return str(stats.get("name", tower_id))


func attack_range() -> float:
	return float(stats.get("range", 100))


## Opções de evolução disponíveis a partir do nó atual (GDD §10).
func upgrade_options() -> Array:
	var result: Array = []
	for next_id in stats.get("next", []):
		var next_stats := GameData.tower_node(tower_id, str(next_id))
		if next_stats.is_empty():
			continue
		result.append({
			"id": str(next_id),
			"name": str(next_stats.get("name", next_id)),
			"cost": int(next_stats.get("upgrade_cost", 0)),
		})
	return result


func upgrade_to(next_id: String) -> bool:
	var next_stats := GameData.tower_node(tower_id, next_id)
	if next_stats.is_empty():
		return false
	var allowed := false
	for candidate in stats.get("next", []):
		if str(candidate) == next_id:
			allowed = true
			break
	if not allowed:
		return false
	var cost := int(next_stats.get("upgrade_cost", 0))
	if not Economy.spend(cost):
		return false
	invested_gold += cost
	_apply_node(next_id)
	return true


func sell_value() -> int:
	return int(round(float(invested_gold) * 0.7))


func can_target(enemy: Enemy) -> bool:
	var targets: Array = stats.get("targets", ["ground"])
	if enemy.flying:
		return targets.has("air")
	return targets.has("ground")


func _process(delta: float) -> void:
	if not Game.running:
		return
	if _flash > 0.0:
		_flash = maxf(0.0, _flash - delta)
		queue_redraw()
	_cooldown = maxf(0.0, _cooldown - delta)
	if _cooldown > 0.0:
		return
	var target := _find_target()
	if target == null:
		return
	_shoot(target)
	_cooldown = 1.0 / maxf(0.05, float(stats.get("attack_speed", 1.0)))


func _find_target() -> Enemy:
	var best: Enemy = null
	var best_score: float = -INF
	var range_sq: float = attack_range() * attack_range()
	for node in get_tree().get_nodes_in_group("enemies"):
		var enemy := node as Enemy
		if enemy == null or enemy.dead or not can_target(enemy):
			continue
		if global_position.distance_squared_to(enemy.global_position) > range_sq:
			continue
		var score: float = 0.0
		match target_mode:
			TargetMode.FIRST:
				score = enemy.distance_travelled
			TargetMode.LAST:
				score = -enemy.distance_travelled
			TargetMode.CLOSEST:
				score = -global_position.distance_squared_to(enemy.global_position)
			TargetMode.STRONGEST:
				score = enemy.hp
		if score > best_score:
			best_score = score
			best = enemy
	return best


func _shoot(target: Enemy) -> void:
	_flash = 0.12
	queue_redraw()
	var damage := float(stats.get("damage", 1))
	var splash := float(stats.get("splash", 0))
	var pierce := float(stats.get("armor_pierce", 0.0))
	var projectile_speed := float(stats.get("projectile_speed", 0))

	if projectile_speed <= 0.0:
		# corpo a corpo: dano imediato
		_apply_damage(target.global_position, target, damage, splash, pierce)
		return

	var projectile := Projectile.new()
	get_parent().add_child(projectile)
	projectile.setup(global_position, target, damage, splash, pierce, projectile_speed, _base_color)


func _apply_damage(at: Vector2, direct_target: Enemy, damage: float, splash: float, pierce: float) -> void:
	if splash <= 0.0:
		if direct_target != null and is_instance_valid(direct_target):
			direct_target.take_damage(damage, pierce)
		return
	var splash_sq := splash * splash
	for node in get_tree().get_nodes_in_group("enemies"):
		var enemy := node as Enemy
		if enemy == null or enemy.dead:
			continue
		if at.distance_squared_to(enemy.global_position) <= splash_sq:
			enemy.take_damage(damage, pierce)


func _draw() -> void:
	if show_range:
		draw_circle(Vector2.ZERO, attack_range(), Color(1, 1, 1, 0.06))
		draw_arc(Vector2.ZERO, attack_range(), 0.0, TAU, 64, Color(1, 1, 1, 0.28), 1.5)
	var body_color := _base_color
	if _flash > 0.0:
		body_color = _base_color.lightened(0.45)
	draw_circle(Vector2(0, 4), 20.0, Color(0, 0, 0, 0.3))
	draw_circle(Vector2.ZERO, 18.0, body_color)
	draw_arc(Vector2.ZERO, 18.0, 0.0, TAU, 32, body_color.darkened(0.5), 2.0)
	var tier := _tier_index()
	for i in tier:
		var angle := -PI * 0.5 + float(i - (tier - 1) * 0.5) * 0.42
		draw_circle(Vector2(cos(angle), sin(angle)) * 25.0, 3.0, Color("#f2c15a"))


## 1 para o nível base, 2 para especialização, 3 para especialização avançada.
func _tier_index() -> int:
	var def := GameData.tower(tower_id)
	var root := str(def.get("root", ""))
	if node_id == root:
		return 1
	var root_stats := GameData.tower_node(tower_id, root)
	for candidate in root_stats.get("next", []):
		if str(candidate) == node_id:
			return 2
	return 3
