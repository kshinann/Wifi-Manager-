import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/auto_launch_service.dart';

enum _Step { intro, notifications, fullScreen, battery, autoLaunch, done }

/// First-open setup for "open when charging": one screen per permission,
/// skipping whatever is already allowed. Android only lets apps pop up a
/// dialog for notifications, so the other steps open the right settings page
/// and the wizard re-checks and moves on when the user comes back.
class SetupWizard extends StatefulWidget {
  const SetupWizard({super.key, required this.service});

  final AutoLaunchService service;

  /// The vendor auto-launch switch can't be read back, so remember that the
  /// user said they turned it on.
  static const autoLaunchConfirmedKey = 'auto_launch_vendor_confirmed';

  static Future<void> show(BuildContext context, AutoLaunchService service) =>
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          fullscreenDialog: true,
          builder: (_) => SetupWizard(service: service),
        ),
      );

  @override
  State<SetupWizard> createState() => _SetupWizardState();
}

class _SetupWizardState extends State<SetupWizard> {
  AutoLaunchStatus? _status;
  _Step _step = _Step.intro;
  bool _busy = false;
  bool _wantEnabled = false;
  bool _autoLaunchConfirmed = false;
  final Set<_Step> _skipped = {};
  late final AppLifecycleListener _lifecycle;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(onResume: _onResume);
    _load();
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _autoLaunchConfirmed = prefs.getBool(SetupWizard.autoLaunchConfirmedKey) ?? false;
    } catch (_) {}
    final s = await widget.service.status();
    if (!mounted) return;
    setState(() {
      _status = s;
      // Re-running setup with the feature already on: go straight to the
      // first missing permission.
      if (s.enabled) {
        _wantEnabled = true;
        _step = _nextStep(s);
      }
    });
  }

  /// Back from a settings page: re-check, and finish turning the feature on
  /// if notifications were just allowed.
  Future<void> _onResume() async {
    if (_step == _Step.intro || _step == _Step.done) return;
    var s = await widget.service.status();
    if (_wantEnabled && !s.enabled && s.notificationsAllowed) {
      s = await widget.service.setEnabled(true);
    }
    if (!mounted) return;
    setState(() {
      _status = s;
      if (!_stillNeeded(_step, s)) _step = _nextStep(s);
    });
  }

  bool _stillNeeded(_Step step, AutoLaunchStatus s) => switch (step) {
        _Step.notifications => !s.notificationsAllowed,
        _Step.fullScreen => !s.fullScreenAllowed,
        _Step.battery => !s.batteryUnrestricted,
        _Step.autoLaunch => s.hasAggressiveBatteryManager && !_autoLaunchConfirmed,
        _Step.intro || _Step.done => false,
      };

  _Step _nextStep(AutoLaunchStatus s) {
    for (final step in const [
      _Step.notifications,
      _Step.fullScreen,
      _Step.battery,
      _Step.autoLaunch,
    ]) {
      if (!_skipped.contains(step) && _stillNeeded(step, s)) return step;
    }
    return _Step.done;
  }

  List<_Step> get _plannedSteps {
    final s = _status;
    if (s == null) return const [];
    return [
      for (final step in const [
        _Step.notifications,
        _Step.fullScreen,
        _Step.battery,
        _Step.autoLaunch,
      ])
        if (step == _step || (_stillNeeded(step, s) && !_skipped.contains(step))) step,
    ];
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _turnOn() => _run(() async {
        _wantEnabled = true;
        final s = await widget.service.setEnabled(true);
        if (!mounted) return;
        setState(() {
          _status = s;
          _step = _nextStep(s);
        });
      });

  Future<void> _allowNotifications() => _run(() async {
        // Shows the system pop-up if Android still allows asking; after two
        // refusals it won't, so fall back to the settings page.
        final s = await widget.service.setEnabled(true);
        if (!mounted) return;
        if (!s.notificationsAllowed) {
          await widget.service.openNotificationSettings();
          return;
        }
        setState(() {
          _status = s;
          _step = _nextStep(s);
        });
      });

  Future<void> _confirmAutoLaunch() async {
    _autoLaunchConfirmed = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(SetupWizard.autoLaunchConfirmedKey, true);
    } catch (_) {}
    if (!mounted) return;
    setState(() => _step = _nextStep(_status!));
  }

  void _skip() => setState(() {
        _skipped.add(_step);
        _step = _nextStep(_status!);
      });

  @override
  Widget build(BuildContext context) {
    final s = _status;
    return Scaffold(
      backgroundColor: const Color(0xFF070A14),
      body: SafeArea(
        child: s == null
            ? const Center(child: CircularProgressIndicator())
            : Padding(
                padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _Progress(steps: _plannedSteps, current: _step),
                    Expanded(
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 300),
                        child: KeyedSubtree(key: ValueKey(_step), child: _page(s)),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _page(AutoLaunchStatus s) {
    final brand = _brand(s.manufacturer);
    return switch (_step) {
      _Step.intro => _StepPage(
          icon: Icons.bolt_rounded,
          color: const Color(0xFF34E7FF),
          title: 'Open when charging?',
          body: 'ChargeVerse can appear over the lock screen every time you '
              'plug in, and close when you unplug.\n\nIt needs a couple of '
              'permissions. This takes about a minute.',
          primary: 'Set it up',
          onPrimary: _busy ? null : _turnOn,
          secondary: 'Not now',
          onSecondary: () => Navigator.pop(context),
        ),
      _Step.notifications => _StepPage(
          icon: Icons.notifications_active_rounded,
          color: const Color(0xFFFFB547),
          title: 'Allow notifications',
          body: 'When you plug in, ChargeVerse opens itself through a '
              'notification. It also keeps one silent notification while it '
              'waits for the charger.\n\nTap Allow on the next pop-up.',
          primary: 'Allow notifications',
          onPrimary: _busy ? null : _allowNotifications,
          secondary: 'Skip',
          onSecondary: _skip,
          warning: 'Without notifications, the app can\'t open when charging.',
        ),
      _Step.fullScreen => _StepPage(
          icon: Icons.fullscreen_rounded,
          color: const Color(0xFFD45CFF),
          title: 'Allow full-screen alerts',
          body: 'This lets ChargeVerse open straight onto your lock screen.\n\n'
              'On the next page, switch on "Allow full-screen notifications" '
              'for ChargeVerse, then come back.',
          primary: 'Open settings',
          onPrimary: widget.service.openFullScreenSettings,
          secondary: 'Skip',
          onSecondary: _skip,
          warning: 'If you skip, plugging in shows a "tap to open" notification instead.',
        ),
      _Step.battery => _StepPage(
          icon: Icons.battery_saver_rounded,
          color: const Color(0xFF3DFF8A),
          title: 'Keep it running',
          body: 'Battery optimization can stop ChargeVerse from noticing the '
              'charger.\n\nOn the next page:\n'
              '1. Switch the list to "All apps"\n'
              '2. Find ChargeVerse\n'
              '3. Choose "Don\'t optimize" (or "Allow")\n\n'
              'Then come back here.',
          primary: 'Open battery settings',
          onPrimary: widget.service.openBatterySettings,
          secondary: 'Skip',
          onSecondary: _skip,
        ),
      _Step.autoLaunch => _StepPage(
          icon: Icons.rocket_launch_rounded,
          color: const Color(0xFFFF6B4A),
          title: 'Allow auto-launch on $brand',
          body: '$brand phones close background apps unless you allow them.\n\n'
              'On the next page, find ChargeVerse and switch on '
              '"Auto-launch" (or "Autostart").\n\n'
              'If App info opens instead, go to Battery usage and turn on '
              '"Allow background activity" too.',
          primary: 'Open $brand settings',
          onPrimary: widget.service.openAutoLaunchSettings,
          secondary: 'I\'ve turned it on',
          onSecondary: _confirmAutoLaunch,
          secondaryIsPrimaryStyle: true,
        ),
      _Step.done => _StepPage(
          icon: s.fullyWorking ? Icons.check_circle_rounded : Icons.info_rounded,
          color: s.fullyWorking ? const Color(0xFF3DFF8A) : const Color(0xFFFFB547),
          title: s.fullyWorking ? 'You\'re all set' : 'Almost there',
          body: s.fullyWorking
              ? 'Lock your phone and plug in the charger to try it.\n\n'
                  'You can change this any time from the ⚙ button.'
              : 'Some permissions were skipped, so opening when charging may '
                  'not work every time. You can finish setup later from the ⚙ '
                  'button.',
          primary: 'Done',
          onPrimary: () => Navigator.pop(context),
        ),
    };
  }

  static String _brand(String m) =>
      m.isEmpty ? 'your phone' : m[0].toUpperCase() + m.substring(1);
}

class _Progress extends StatelessWidget {
  const _Progress({required this.steps, required this.current});

  final List<_Step> steps;
  final _Step current;

  @override
  Widget build(BuildContext context) {
    final index = steps.indexOf(current);
    if (steps.isEmpty || index < 0) return const SizedBox(height: 24);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Step ${index + 1} of ${steps.length}',
          style: const TextStyle(color: Colors.white54, fontSize: 12),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            for (var i = 0; i < steps.length; i++)
              Expanded(
                child: Container(
                  height: 4,
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  decoration: BoxDecoration(
                    color: i <= index ? const Color(0xFF34E7FF) : Colors.white12,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _StepPage extends StatelessWidget {
  const _StepPage({
    required this.icon,
    required this.color,
    required this.title,
    required this.body,
    required this.primary,
    required this.onPrimary,
    this.secondary,
    this.onSecondary,
    this.warning,
    this.secondaryIsPrimaryStyle = false,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String body;
  final String primary;
  final VoidCallback? onPrimary;
  final String? secondary;
  final VoidCallback? onSecondary;
  final String? warning;

  /// For steps where the second button is a real answer, not a skip.
  final bool secondaryIsPrimaryStyle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: SingleChildScrollView(
            child: Column(
              children: [
                const SizedBox(height: 40),
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: color.withValues(alpha: 0.15),
                    boxShadow: [BoxShadow(color: color.withValues(alpha: 0.4), blurRadius: 40)],
                  ),
                  child: Icon(icon, size: 48, color: color),
                ),
                const SizedBox(height: 28),
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  body,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.75),
                    fontSize: 15,
                    height: 1.45,
                  ),
                ),
                if (warning != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    warning!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Color(0xFFFFB547), fontSize: 13),
                  ),
                ],
              ],
            ),
          ),
        ),
        FilledButton(
          onPressed: onPrimary,
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
          child: Text(primary),
        ),
        if (secondary != null) ...[
          const SizedBox(height: 8),
          if (secondaryIsPrimaryStyle)
            OutlinedButton(
              onPressed: onSecondary,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                foregroundColor: Colors.white,
              ),
              child: Text(secondary!),
            )
          else
            TextButton(onPressed: onSecondary, child: Text(secondary!)),
        ],
      ],
    );
  }
}
