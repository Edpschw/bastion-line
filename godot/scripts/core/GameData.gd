extends Node
## Carrega todos os dados de gameplay dos arquivos JSON.
## Nenhum atributo de balanceamento deve ser escrito direto na lógica (GDD §6 e §43).

var enemies: Dictionary = {}
var towers: Dictionary = {}
var waves: Dictionary = {}
var map: Dictionary = {}


func _ready() -> void:
	load_all()


func load_all() -> void:
	enemies = _read_json("res://data/enemies/enemies.json")
	towers = _read_json("res://data/towers/towers.json")
	waves = _read_json("res://data/waves/waves.json")
	map = _read_json("res://data/maps/map01.json")


func _read_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		push_error("GameData: arquivo nao encontrado: %s" % path)
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("GameData: falha ao abrir: %s" % path)
		return {}
	var text := file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("GameData: JSON invalido em %s" % path)
		return {}
	return parsed as Dictionary


func enemy(type_id: String) -> Dictionary:
	return enemies.get(type_id, {}) as Dictionary


func tower(tower_id: String) -> Dictionary:
	return towers.get(tower_id, {}) as Dictionary


## Stats de um nó específico da árvore de evolução de uma torre.
func tower_node(tower_id: String, node_id: String) -> Dictionary:
	var t := tower(tower_id)
	var nodes: Dictionary = t.get("nodes", {})
	return nodes.get(node_id, {}) as Dictionary


func wave_count() -> int:
	var list: Array = waves.get("waves", [])
	return list.size()


func wave(index: int) -> Dictionary:
	var list: Array = waves.get("waves", [])
	if index < 0 or index >= list.size():
		return {}
	return list[index] as Dictionary


func setting(key: String, fallback: Variant) -> Variant:
	return waves.get(key, fallback)
