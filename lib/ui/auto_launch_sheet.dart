import 'package:flutter/material.dart';

import '../services/auto_launch_service.dart';

/// Settings for "open automatically when charging", with a checklist of the
/// system permissions it needs and buttons straight to each settings page.
class AutoLaunchSheet extends StatefulWidget {
  const AutoLaunchSheet({super.key, required this.service});

  final AutoLaunchService service;

  static Future<void> show(BuildContext context, AutoLaunchService service) =>
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: const Color(0xFF0D111C),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        builder: (_) => AutoLaunchSheet(service: service),
      );

  @override
  State<AutoLaunchSheet> createState() => _AutoLaunchSheetState();
}

class _AutoLaunchSheetState extends State<AutoLaunchSheet> {
  AutoLaunchStatus? _status;
  bool _busy = false;
  late final AppLifecycleListener _lifecycle;

  @override
  void initState() {
    super.initState();
    // Re-check when the user comes back from a system settings page.
    _lifecycle = AppLifecycleListener(onResume: _refresh);
    _refresh();
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    final s = await widget.service.status();
    if (mounted) setState(() => _status = s);
  }

  Future<void> _toggle(bool on) async {
    setState(() => _busy = true);
    final s = await widget.service.setEnabled(on);
    if (!mounted) return;
    setState(() {
      _status = s;
      _busy = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = _status;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (s == null)
              const Center(child: CircularProgressIndicator())
            else if (!s.supported)
              const Text(
                'Opening automatically when charging is only available on Android.',
                style: TextStyle(color: Colors.white70),
              )
            else ...[
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: s.enabled,
                onChanged: _busy ? null : _toggle,
                title: const Text(
                  'Open when charging',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                ),
                subtitle: const Text(
                  'Shows ChargeVerse over the lock screen when you plug in, '
                  'and closes it when you unplug.',
                  style: TextStyle(color: Colors.white60),
                ),
              ),
              if (s.enabled) ...[
                const Divider(color: Colors.white12),
                _Check(
                  ok: s.notificationsAllowed,
                  title: 'Notifications',
                  detail: 'Needed to open the charging screen.',
                  action: 'Allow',
                  onTap: widget.service.openNotificationSettings,
                ),
                _Check(
                  ok: s.fullScreenAllowed,
                  title: 'Full-screen alerts',
                  detail: s.fullScreenAllowed
                      ? 'Opens straight away on the lock screen.'
                      : 'Off: you will get a "tap to open" notification instead.',
                  action: 'Allow',
                  onTap: widget.service.openFullScreenSettings,
                ),
                _Check(
                  ok: s.batteryUnrestricted,
                  title: 'Battery optimization',
                  detail: s.batteryUnrestricted
                      ? 'Unrestricted, so Android won\'t stop the watcher.'
                      : 'Set ChargeVerse to "Don\'t optimize" so it keeps working.',
                  action: 'Open',
                  onTap: widget.service.openBatterySettings,
                ),
                if (s.hasAggressiveBatteryManager)
                  _Check(
                    ok: null,
                    title: 'Auto-launch (${_brand(s.manufacturer)})',
                    detail: 'Your phone also needs Auto-launch / Allow background '
                        'activity turned on for ChargeVerse in App info.',
                    action: 'App info',
                    onTap: widget.service.openAppSettings,
                  ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  static String _brand(String m) => m.isEmpty ? m : m[0].toUpperCase() + m.substring(1);
}

class _Check extends StatelessWidget {
  const _Check({
    required this.ok,
    required this.title,
    required this.detail,
    required this.action,
    required this.onTap,
  });

  /// null means "can't detect, please check".
  final bool? ok;
  final String title;
  final String detail;
  final String action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final icon = switch (ok) {
      true => const Icon(Icons.check_circle_rounded, color: Color(0xFF3DFF8A)),
      false => const Icon(Icons.error_rounded, color: Color(0xFFFFB547)),
      null => const Icon(Icons.help_rounded, color: Colors.white54),
    };
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: icon,
      title: Text(title, style: const TextStyle(color: Colors.white)),
      subtitle: Text(detail, style: const TextStyle(color: Colors.white60, fontSize: 12)),
      trailing: ok == true ? null : TextButton(onPressed: onTap, child: Text(action)),
    );
  }
}
