package com.chargeverse.charge_verse

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Restarts the charger watcher after a reboot or an app update. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            -> AutoLaunch.start(context)
        }
    }
}
