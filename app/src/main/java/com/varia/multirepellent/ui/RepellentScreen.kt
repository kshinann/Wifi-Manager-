package com.varia.multirepellent.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.varia.multirepellent.audio.DeviceAudioInfo
import com.varia.multirepellent.audio.ToneEngine
import com.varia.multirepellent.model.AnimalPreset
import com.varia.multirepellent.model.AnimalPresets
import com.varia.multirepellent.model.EvidenceLevel
import com.varia.multirepellent.ui.theme.FrequencyReadoutStyle
import kotlinx.coroutines.delay
import kotlin.math.roundToInt

private const val SWEEP_DURATION_MS = 6_000
private const val SWEEP_STEPS = 120
private const val MIN_REACHABLE_HZ = 20f

@Composable
fun RepellentApp() {
    val context = LocalContext.current
    val sampleRate = remember { DeviceAudioInfo.nativeSampleRate(context) }
    val nyquistHz = sampleRate / 2
    val engine = remember { ToneEngine(sampleRate) }

    var selected by remember { mutableStateOf(AnimalPresets.all.first()) }
    var reachableLo by remember { mutableFloatStateOf(reachableRange(selected, nyquistHz).first) }
    var reachableHi by remember { mutableFloatStateOf(reachableRange(selected, nyquistHz).second) }
    var frequency by remember { mutableFloatStateOf(selected.defaultHz.coerceIn(reachableLo, reachableHi)) }
    var volume by remember { mutableFloatStateOf(0.6f) }
    var isPlaying by remember { mutableStateOf(false) }
    var sweepOn by remember { mutableStateOf(false) }

    DisposableEffect(Unit) {
        onDispose { engine.stop() }
    }

    LaunchedEffect(frequency) { engine.frequencyHz = frequency }
    LaunchedEffect(volume) { engine.amplitude = volume }

    LaunchedEffect(isPlaying, sweepOn, selected) {
        if (isPlaying && sweepOn) {
            val (lo, hi) = reachableRange(selected, nyquistHz)
            while (true) {
                for (step in 0..SWEEP_STEPS) {
                    val t = step / SWEEP_STEPS.toFloat()
                    frequency = lo + (hi - lo) * t
                    delay((SWEEP_DURATION_MS / SWEEP_STEPS).toLong())
                }
            }
        }
    }

    fun selectPreset(preset: AnimalPreset) {
        if (isPlaying) {
            isPlaying = false
            engine.stop()
        }
        selected = preset
        val (lo, hi) = reachableRange(preset, nyquistHz)
        reachableLo = lo
        reachableHi = hi
        frequency = preset.defaultHz.coerceIn(lo, hi)
    }

    Surface(color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Header()
            DisclaimerCard()
            DeviceCapabilityCard(sampleRate = sampleRate, nyquistHz = nyquistHz)
            AnimalPicker(selected = selected, onSelect = ::selectPreset)
            EvidenceNote(selected)
            FrequencyControlCard(
                frequency = frequency,
                rangeLo = reachableLo,
                rangeHi = reachableHi,
                clamped = selected.maxHz > nyquistHz,
                presetMaxHz = selected.maxHz,
                nyquistHz = nyquistHz,
                sweepOn = sweepOn,
                onFrequencyChange = {
                    sweepOn = false
                    frequency = it
                }
            )
            PlaybackControls(
                isPlaying = isPlaying,
                volume = volume,
                sweepOn = sweepOn,
                onTogglePlay = {
                    isPlaying = !isPlaying
                    if (isPlaying) engine.start() else engine.stop()
                },
                onVolumeChange = { volume = it },
                onSweepToggle = { sweepOn = it }
            )
            SafetyFooter()
        }
    }
}

/** Clamps a preset's marketed range to what the device can digitally output at all. */
private fun reachableRange(preset: AnimalPreset, nyquistHz: Int): Pair<Float, Float> {
    val deviceCeiling = nyquistHz.toFloat()
    val lo = preset.minHz.coerceAtMost(deviceCeiling - 1f).coerceAtLeast(MIN_REACHABLE_HZ)
    val hi = preset.maxHz.coerceAtMost(deviceCeiling).coerceAtLeast(lo + 1f)
    return lo to hi
}

@Composable
private fun Header() {
    Column {
        Text(
            text = "Multi Repellent",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground
        )
        Text(
            text = "A frequency experiment lab, not a proven pest control device.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
        )
    }
}

@Composable
private fun DisclaimerCard() {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.12f)
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = "Read this first",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.secondary
            )
            Text(
                text = "No brand of ultrasonic \"repellent\" is scientifically proven to drive away " +
                    "mosquitoes, rodents, cats, or lizards. This app generates real tones so you can " +
                    "hear what's being sold and test what your own phone can actually produce - " +
                    "it is not pest control.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground
            )
        }
    }
}

@Composable
private fun DeviceCapabilityCard(sampleRate: Int, nyquistHz: Int) {
    Card(shape = RoundedCornerShape(16.dp)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Can your phone support this?", style = MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                LabeledStat(label = "Output sample rate", value = "$sampleRate Hz")
                LabeledStat(label = "Digital ceiling", value = "$nyquistHz Hz")
            }
            Text(
                text = "That ceiling (the Nyquist limit) is the highest tone Android can even encode " +
                    "on this device - it is not what the speaker can be heard playing. Android has no " +
                    "API for a speaker's real frequency response, and most phone speakers roll off well " +
                    "before their digital ceiling. Use \"Sweep this range\" below and listen: wherever the " +
                    "tone fades to silence is your phone's real limit.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.75f)
            )
        }
    }
}

@Composable
private fun LabeledStat(label: String, value: String) {
    Column {
        Text(
            text = label.uppercase(),
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.55f)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary
        )
    }
}

@Composable
private fun AnimalPicker(selected: AnimalPreset, onSelect: (AnimalPreset) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Choose what you're testing against", style = MaterialTheme.typography.titleMedium)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            items(AnimalPresets.all) { preset ->
                AnimalChip(preset = preset, isSelected = preset.id == selected.id, onClick = { onSelect(preset) })
            }
        }
    }
}

@Composable
private fun AnimalChip(preset: AnimalPreset, isSelected: Boolean, onClick: () -> Unit) {
    val borderColor = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onBackground.copy(alpha = 0.15f)
    val bgColor = if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surface

    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(14.dp),
        color = bgColor,
        border = BorderStroke(1.5.dp, borderColor)
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp).width(88.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(preset.emoji, style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.height(4.dp))
            Text(
                preset.displayName,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onBackground,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun EvidenceNote(preset: AnimalPreset) {
    val label = if (preset.evidenceLevel == EvidenceLevel.NONE) "No known mechanism" else "Disputed evidence"
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = label.uppercase(),
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.secondary
        )
        Text(
            text = preset.evidenceNote,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.8f)
        )
    }
}

@Composable
private fun FrequencyControlCard(
    frequency: Float,
    rangeLo: Float,
    rangeHi: Float,
    clamped: Boolean,
    presetMaxHz: Float,
    nyquistHz: Int,
    sweepOn: Boolean,
    onFrequencyChange: (Float) -> Unit
) {
    Card(shape = RoundedCornerShape(16.dp)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = "${frequency.roundToInt()} Hz",
                style = FrequencyReadoutStyle,
                color = MaterialTheme.colorScheme.primary
            )
            Slider(
                value = frequency,
                onValueChange = onFrequencyChange,
                valueRange = rangeLo..rangeHi,
                enabled = !sweepOn
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${rangeLo.roundToInt()} Hz", style = MaterialTheme.typography.labelLarge)
                Text("${rangeHi.roundToInt()} Hz", style = MaterialTheme.typography.labelLarge)
            }
            if (clamped) {
                Text(
                    text = "This preset's typical range goes up to ${presetMaxHz.roundToInt()} Hz, past " +
                        "your device's $nyquistHz Hz ceiling - the slider above is clamped to what this " +
                        "phone can actually output.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.secondary
                )
            }
        }
    }
}

@Composable
private fun PlaybackControls(
    isPlaying: Boolean,
    volume: Float,
    sweepOn: Boolean,
    onTogglePlay: () -> Unit,
    onVolumeChange: (Float) -> Unit,
    onSweepToggle: (Boolean) -> Unit
) {
    Card(shape = RoundedCornerShape(16.dp)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Sweep this range", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Ramps low to high on repeat - listen for where it disappears",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)
                    )
                }
                Switch(checked = sweepOn, onCheckedChange = onSweepToggle)
            }

            Column {
                Text("Volume", style = MaterialTheme.typography.labelLarge)
                Slider(value = volume, onValueChange = onVolumeChange, valueRange = 0f..1f)
            }

            Button(
                onClick = onTogglePlay,
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(14.dp)
            ) {
                Text(if (isPlaying) "■  Stop" else "▶  Play tone")
            }
        }
    }
}

@Composable
private fun SafetyFooter() {
    Text(
        text = "Hearing safety: keep volume moderate and take breaks during long sessions. Tones " +
            "above human hearing are still audible to pets - don't confine an animal near sustained " +
            "high-volume ultrasound.",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.55f)
    )
}
