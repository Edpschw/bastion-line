class_name HUD
extends CanvasLayer
## HUD do protótipo (GDD §33): vida da base, ouro, onda, torres e painel da torre selecionada.

signal tower_selected_for_build(tower_id: String)
signal upgrade_requested(option_id: String)
signal sell_requested()
signal call_wave_requested()
signal restart_requested()

var _gold_label: Label
var _hp_label: Label
var _wave_label: Label
var _status_label: Label
var _call_button: Button
var _shop_box: HBoxContainer
var _panel: PanelContainer
var _panel_box: VBoxContainer
var _overlay: PanelContainer
var _overlay_label: Label

var _build_selection: String = ""


func _ready() -> void:
	_build_top_bar()
	_build_shop()
	_build_panel()
	_build_overlay()


func _build_top_bar() -> void:
	var bar := PanelContainer.new()
	bar.set_anchors_preset(Control.PRESET_TOP_WIDE)
	bar.custom_minimum_size = Vector2(0, 56)
	add_child(bar)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 18)
	bar.add_child(row)

	_hp_label = _make_label("Base 20")
	_gold_label = _make_label("Ouro 0")
	_wave_label = _make_label("Onda 0/20")
	_status_label = _make_label("Construcao")
	row.add_child(_hp_label)
	row.add_child(_gold_label)
	row.add_child(_wave_label)
	row.add_child(_status_label)

	_call_button = Button.new()
	_call_button.text = "Chamar onda"
	_call_button.pressed.connect(func() -> void: call_wave_requested.emit())
	row.add_child(_call_button)


func _make_label(text: String) -> Label:
	var label := Label.new()
	label.text = text
	return label


func _build_shop() -> void:
	var holder := PanelContainer.new()
	holder.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	holder.custom_minimum_size = Vector2(0, 64)
	holder.position = Vector2(0, -64)
	add_child(holder)

	_shop_box = HBoxContainer.new()
	_shop_box.add_theme_constant_override("separation", 10)
	holder.add_child(_shop_box)

	for tower_id in GameData.towers.keys():
		var def := GameData.tower(str(tower_id))
		var button := Button.new()
		button.toggle_mode = true
		button.text = "%s  %dg" % [str(def.get("display_name", tower_id)), int(def.get("cost", 0))]
		button.pressed.connect(_on_shop_pressed.bind(str(tower_id), button))
		_shop_box.add_child(button)


func _on_shop_pressed(tower_id: String, button: Button) -> void:
	for child in _shop_box.get_children():
		var other := child as Button
		if other != null and other != button:
			other.button_pressed = false
	_build_selection = tower_id if button.button_pressed else ""
	tower_selected_for_build.emit(_build_selection)


func clear_build_selection() -> void:
	_build_selection = ""
	for child in _shop_box.get_children():
		var button := child as Button
		if button != null:
			button.button_pressed = false


func _build_panel() -> void:
	_panel = PanelContainer.new()
	_panel.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_panel.position = Vector2(-250, 70)
	_panel.custom_minimum_size = Vector2(238, 0)
	_panel.visible = false
	add_child(_panel)

	_panel_box = VBoxContainer.new()
	_panel_box.add_theme_constant_override("separation", 6)
	_panel.add_child(_panel_box)


func show_tower(tower: Tower) -> void:
	for child in _panel_box.get_children():
		child.queue_free()

	var title := _make_label(tower.display_name())
	_panel_box.add_child(title)
	_panel_box.add_child(_make_label("Dano %d" % int(tower.stats.get("damage", 0))))
	_panel_box.add_child(_make_label("Alcance %d" % int(tower.attack_range())))
	_panel_box.add_child(_make_label("Ataques/s %.2f" % float(tower.stats.get("attack_speed", 0))))
	if float(tower.stats.get("splash", 0)) > 0.0:
		_panel_box.add_child(_make_label("Area %d" % int(tower.stats.get("splash", 0))))
	var targets: Array = tower.stats.get("targets", [])
	_panel_box.add_child(_make_label("Alvos: %s" % ", ".join(targets)))

	var options := tower.upgrade_options()
	if options.is_empty():
		_panel_box.add_child(_make_label("Evolucao maxima"))
	else:
		for option_variant in options:
			var option: Dictionary = option_variant as Dictionary
			var button := Button.new()
			button.text = "%s  %dg" % [str(option.get("name", "")), int(option.get("cost", 0))]
			button.disabled = not Economy.can_afford(int(option.get("cost", 0)))
			button.pressed.connect(func() -> void: upgrade_requested.emit(str(option.get("id", ""))))
			_panel_box.add_child(button)

	var sell := Button.new()
	sell.text = "Vender  +%dg" % tower.sell_value()
	sell.pressed.connect(func() -> void: sell_requested.emit())
	_panel_box.add_child(sell)

	_panel.visible = true


func hide_tower() -> void:
	_panel.visible = false


func _build_overlay() -> void:
	_overlay = PanelContainer.new()
	_overlay.set_anchors_preset(Control.PRESET_CENTER)
	_overlay.position = Vector2(-150, -70)
	_overlay.custom_minimum_size = Vector2(300, 140)
	_overlay.visible = false
	add_child(_overlay)

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)
	_overlay.add_child(box)

	_overlay_label = _make_label("")
	box.add_child(_overlay_label)

	var restart := Button.new()
	restart.text = "Jogar novamente"
	restart.pressed.connect(func() -> void: restart_requested.emit())
	box.add_child(restart)


func show_result(victory: bool, wave_reached: int) -> void:
	_overlay_label.text = "Vitoria! Reino defendido." if victory else "Derrota na onda %d." % wave_reached
	_overlay.visible = true


func hide_result() -> void:
	_overlay.visible = false


func set_gold(value: int) -> void:
	_gold_label.text = "Ouro %d" % value


func set_base_hp(hp: int, max_hp: int) -> void:
	_hp_label.text = "Base %d/%d" % [hp, max_hp]


func set_wave(index: int, total: int) -> void:
	_wave_label.text = "Onda %d/%d" % [index, total]


func set_status(text: String) -> void:
	_status_label.text = text


func set_call_enabled(enabled: bool) -> void:
	_call_button.disabled = not enabled
