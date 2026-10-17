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
import 'auto_launch_sheet.dart';
import 'formatting.dart';
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

  /// Asks once, on first launch, whether to open automatically on plug-in.
  Future<void> _maybePromptAutoLaunch() async {
    if (!AutoLaunchService.isAvailable) return;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (prefs.getBool(_autoLaunchPromptedKey) ?? false) return;
      final status = await _autoLaunch.status();
      if (!status.supported || status.enabled || !mounted) return;
      await prefs.setBool(_autoLaunchPromptedKey, true);
      if (!mounted) return;
      final yes = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          icon: const Icon(Icons.bolt_rounded),
          title: const Text('Open when charging?'),
          content: const Text(
            'ChargeVerse can appear over the lock screen every time you plug '
            'in, and close when you unplug. It keeps a small silent '
            'notification while it waits for the charger. You can change '
            'this any time in settings.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Not now'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Turn on'),
            ),
          ],
        ),
      );
      if (yes != true || !mounted) return;
      final result = await _autoLaunch.setEnabled(true);
      if (!mounted) return;
      if (!result.fullyWorking || !result.batteryUnrestricted || result.hasAggressiveBatteryManager) {
        // Show what still needs allowing (permissions, battery, OPPO auto-launch).
        await AutoLaunchSheet.show(context, _autoLaunch);
      }
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
                  child: CustomPaint(
                    key: ValueKey(_style),
                    painter: _style.painter(_frame),
                    size: Size.infinite,
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
                  const SizedBox(height: 10),
                  _StylePicker(selected: _style, onSelected: _setStyle),
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

class _StylePicker extends StatelessWidget {
  const _StylePicker({required this.selected, required this.onSelected});

  final ArtStyle selected;
  final ValueChanged<ArtStyle> onSelected;

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<ArtStyle>(
      segments: [
        for (final s in ArtStyle.values)
          ButtonSegment(value: s, icon: Icon(s.icon, size: 18), label: Text(s.label)),
      ],
      selected: {selected},
      onSelectionChanged: (set) => onSelected(set.first),
      showSelectedIcon: false,
      style: ButtonStyle(
        visualDensity: VisualDensity.compact,
        foregroundColor: const WidgetStatePropertyAll(Colors.white),
        backgroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? Colors.white.withValues(alpha: 0.18)
              : Colors.white.withValues(alpha: 0.04),
        ),
        side: WidgetStatePropertyAll(
          BorderSide(color: Colors.white.withValues(alpha: 0.15)),
        ),
        textStyle: const WidgetStatePropertyAll(TextStyle(fontSize: 12)),
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
