import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../art/art_frame.dart';
import '../art/art_style.dart';
import '../models/battery_reading.dart';
import '../services/auto_launch_service.dart';
import '../services/battery_service.dart';
import '../services/charge_analyzer.dart';
import '../video/video_cache.dart';
import '../video/video_scene.dart';
import 'auto_launch_sheet.dart';
import 'formatting.dart';
import 'setup_wizard.dart';
import 'stats_panel.dart';

class ChargingScreen extends StatefulWidget {
  const ChargingScreen({super.key});

  @override
  State<ChargingScreen> createState() => _ChargingScreenState();
}

class _ChargingScreenState extends State<ChargingScreen>
    with SingleTickerProviderStateMixin {
  static const _styleKey = 'art_style';
  static const _autoLaunchPromptedKey = 'auto_launch_prompted';

  final _analyzer = ChargeAnalyzer();
  final _autoLaunch = AutoLaunchService();
  final _videoCache = VideoCache();
  final _credit = ValueNotifier<SceneCredit?>(null);
  final _frame = ValueNotifier(ArtFrame.initial);
  late final Ticker _ticker;
  StreamSubscription<BatteryReading>? _sub;

  ArtStyle _style = ArtStyle.liquidOrb;
  ChargeSnapshot? _snapshot;
  bool _demo = false;
  bool _liveUnavailable = false;
  double _demoWatts = 18;

  // Animated values ease toward the latest snapshot so changes glide.
  Duration _lastTick = Duration.zero;
  double _phase = 0;
  double _level = 0;
  double _intensity = 0;
  Color _accent = ArtFrame.initial.accent;

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick)..start();
    _loadStyle();
    _startSource();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybePromptAutoLaunch());
  }

  @override
  void dispose() {
    _ticker.dispose();
    _sub?.cancel();
    _frame.dispose();
    _credit.dispose();
    super.dispose();
  }

  Future<void> _loadStyle() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (!mounted) return;
      setState(() => _style = ArtStyle.fromName(prefs.getString(_styleKey)));
    } catch (_) {
      // Preferences are a convenience; keep the default style.
    }
  }

  /// On first launch, walks through turning on "open when charging".
  Future<void> _maybePromptAutoLaunch() async {
    if (!AutoLaunchService.isAvailable) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (prefs.getBool(_autoLaunchPromptedKey) ?? false) return;
      final status = await _autoLaunch.status();
      if (!status.supported || status.enabled || !mounted) return;
      await prefs.setBool(_autoLaunchPromptedKey, true);
      if (!mounted) return;
      await SetupWizard.show(context, _autoLaunch);
    } catch (_) {
      // First-run prompt is best effort.
    }
  }

  Future<void> _setStyle(ArtStyle style) async {
    HapticFeedback.selectionClick();
    setState(() => _style = style);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_styleKey, style.name);
    } catch (_) {}
  }

  void _startSource() {
    _sub?.cancel();
    _analyzer.reset();
    final source = _demo || kIsWeb
        ? DemoBattery(watts: () => _demoWatts).readings()
        : BatteryService().readings();
    _sub = source.listen(
      (r) => setState(() => _snapshot = _analyzer.add(r)),
      onError: (Object e) {
        // No native side (desktop, web, or a platform we don't support):
        // fall back to the simulator so the app still shows something.
        if (_demo) return;
        setState(() {
          _liveUnavailable = true;
          _demo = true;
        });
        _startSource();
      },
    );
  }

  void _toggleDemo() {
    if (_liveUnavailable && _demo) return;
    setState(() {
      _demo = !_demo;
      _snapshot = null;
    });
    _startSource();
  }

  void _onTick(Duration elapsed) {
    final dt = math.min(0.05, (elapsed - _lastTick).inMicroseconds / 1e6);
    _lastTick = elapsed;
    final s = _snapshot;
    final cls = s?.chargeClass ?? ChargeClass.measuring;

    final ease = 1 - math.exp(-dt * 3);
    _level += ((s?.level ?? 0) / 100 - _level) * ease;
    _intensity += ((s?.intensity ?? 0.2) - _intensity) * ease;
    _accent = Color.lerp(_accent, cls.color, ease)!;
    _phase += dt * (0.25 + _intensity * 2.4);

    _frame.value = ArtFrame(
      time: elapsed.inMicroseconds / 1e6,
      phase: _phase,
      level: _level,
      intensity: _intensity,
      charging: s?.reading.isCharging ?? false,
      accent: _accent,
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = _snapshot;
    final cls = s?.chargeClass ?? ChargeClass.measuring;

    return Scaffold(
      backgroundColor: const Color(0xFF020307),
      body: Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onHorizontalDragEnd: (d) {
                final v = d.primaryVelocity ?? 0;
                if (v.abs() < 200) return;
                _setStyle(v < 0 ? _style.next : _style.previous);
              },
              child: RepaintBoundary(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 450),
                  child: ArtBackground(
                    key: ValueKey(_style),
                    style: _style,
                    frame: _frame,
                    cache: _videoCache,
                    credit: _credit,
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Column(
                children: [
                  _TopBar(
                    demo: _demo,
                    demoLocked: _liveUnavailable,
                    onToggleDemo: _toggleDemo,
                    onSettings: AutoLaunchService.isAvailable
                        ? () => AutoLaunchSheet.show(context, _autoLaunch)
                        : null,
                  ),
                  const SizedBox(height: 6),
                  _StylePicker(selected: _style, onSelected: _setStyle),
                  // Pexels asks for the videographer to be credited.
                  ValueListenableBuilder<SceneCredit?>(
                    valueListenable: _credit,
                    builder: (context, credit, _) => credit == null || credit.style != _style
                        ? const SizedBox.shrink()
                        : Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              credit.text,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.55),
                                fontSize: 10,
                              ),
                            ),
                          ),
                  ),
                  const Spacer(),
                  IgnorePointer(child: _LevelReadout(snapshot: s, color: cls.color)),
                  const SizedBox(height: 14),
                  if (_demo) ...[
                    _DemoSlider(
                      watts: _demoWatts,
                      onChanged: (v) => setState(() => _demoWatts = v),
                    ),
                    const SizedBox(height: 10),
                  ],
                  StatsPanel(snapshot: s),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.demo,
    required this.demoLocked,
    required this.onToggleDemo,
    this.onSettings,
  });

  final bool demo;
  final bool demoLocked;
  final VoidCallback onToggleDemo;
  final VoidCallback? onSettings;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(Icons.bolt_rounded, color: Colors.white),
        const SizedBox(width: 6),
        const Text(
          'ChargeVerse',
          style: TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.5,
          ),
        ),
        const Spacer(),
        Tooltip(
          message: demoLocked
              ? 'Live battery data is not available on this platform'
              : demo
                  ? 'Switch to live battery data'
                  : 'Try demo mode with a simulated charger',
          child: FilterChip(
            label: Text(demo ? 'DEMO' : 'LIVE'),
            avatar: Icon(
              demo ? Icons.science_rounded : Icons.sensors_rounded,
              size: 16,
              color: Colors.white,
            ),
            selected: demo,
            showCheckmark: false,
            onSelected: demoLocked ? null : (_) => onToggleDemo(),
            labelStyle: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
            backgroundColor: Colors.white.withValues(alpha: 0.08),
            selectedColor: const Color(0xFFD45CFF).withValues(alpha: 0.35),
            side: BorderSide(color: Colors.white.withValues(alpha: 0.15)),
          ),
        ),
        if (onSettings != null)
          IconButton(
            tooltip: 'Open when charging',
            onPressed: onSettings,
            icon: const Icon(Icons.settings_rounded, color: Colors.white),
          ),
      ],
    );
  }
}

/// Horizontally scrolling row of theme buttons. Keeps the selected theme in
/// view when it changes, e.g. after swiping across the artwork.
class _StylePicker extends StatefulWidget {
  const _StylePicker({required this.selected, required this.onSelected});

  final ArtStyle selected;
  final ValueChanged<ArtStyle> onSelected;

  @override
  State<_StylePicker> createState() => _StylePickerState();
}

class _StylePickerState extends State<_StylePicker> {
  static const _itemWidth = 68.0;
  static const _gap = 6.0;
  final _controller = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _reveal(animate: false));
  }

  @override
  void didUpdateWidget(_StylePicker oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selected != widget.selected) _reveal(animate: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Scrolls so the selected theme sits in the middle of the strip.
  void _reveal({required bool animate}) {
    if (!_controller.hasClients) return;
    final pos = _controller.position;
    final target = (widget.selected.index * (_itemWidth + _gap) -
            (pos.viewportDimension - _itemWidth) / 2)
        .clamp(pos.minScrollExtent, pos.maxScrollExtent);
    if (animate) {
      _controller.animateTo(
        target,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );
    } else {
      _controller.jumpTo(target);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 74,
      child: ListView.separated(
        controller: _controller,
        scrollDirection: Axis.horizontal,
        itemCount: ArtStyle.values.length,
        separatorBuilder: (context, index) => const SizedBox(width: _gap),
        itemBuilder: (context, i) {
          final style = ArtStyle.values[i];
          final selected = style == widget.selected;
          return Semantics(
            selected: selected,
            button: true,
            label: style.label,
            child: GestureDetector(
              onTap: () => widget.onSelected(style),
              child: SizedBox(
                width: _itemWidth,
                child: Column(
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 250),
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: style.tint.withValues(alpha: selected ? 0.3 : 0.1),
                        border: Border.all(
                          color: selected ? style.tint : Colors.white.withValues(alpha: 0.12),
                          width: selected ? 2 : 1,
                        ),
                        boxShadow: selected
                            ? [BoxShadow(color: style.tint.withValues(alpha: 0.5), blurRadius: 14)]
                            : null,
                      ),
                      child: Icon(
                        style.icon,
                        size: 22,
                        color: selected ? Colors.white : style.tint.withValues(alpha: 0.85),
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      style.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: selected ? Colors.white : Colors.white60,
                        fontSize: 11,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _LevelReadout extends StatelessWidget {
  const _LevelReadout({required this.snapshot, required this.color});

  final ChargeSnapshot? snapshot;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final s = snapshot;
    return Column(
      children: [
        Text(
          s == null ? '--%' : '${s.level.round()}%',
          style: TextStyle(
            color: Colors.white,
            fontSize: 64,
            fontWeight: FontWeight.w800,
            height: 1,
            shadows: [Shadow(color: color, blurRadius: 24)],
          ),
        ),
        const SizedBox(height: 4),
        Text(
          s == null
              ? 'Connecting to battery…'
              : (s.chargeClass.label +
                  (s.reading.source == BatterySource.demo ? ' (simulated)' : '')),
          style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 15),
        ),
      ],
    );
  }
}

class _DemoSlider extends StatelessWidget {
  const _DemoSlider({required this.watts, required this.onChanged});

  final double watts;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Text('Charger', style: TextStyle(color: Colors.white70, fontSize: 12)),
        Expanded(
          child: Slider(
            value: watts,
            min: 2,
            max: 65,
            divisions: 63,
            label: '${watts.round()} W',
            onChanged: onChanged,
          ),
        ),
        SizedBox(
          width: 44,
          child: Text(
            '${watts.round()} W',
            textAlign: TextAlign.end,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}
