package com.measurekit.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AssistChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.measurekit.app.MeasurementStore
import com.measurekit.app.units.UnitSystem
import com.measurekit.app.units.Units
import java.util.Locale

/**
 * Text field for a real-world distance, typed in metres or feet, with a shortcut that fills in
 * the last length measured with the AR Length tool. Reports metres, or null when it's empty or invalid.
 */
@Composable
fun DistanceField(
    label: String,
    units: UnitSystem,
    onMeters: (Double?) -> Unit,
    modifier: Modifier = Modifier,
) {
    var text by rememberSaveable { mutableStateOf("") }
    val arLength by MeasurementStore.lastLengthMeters.collectAsStateWithLifecycle()

    val report by rememberUpdatedState(onMeters)
    LaunchedEffect(text, units) {
        val v = text.replace(',', '.').toDoubleOrNull()?.takeIf { it > 0 }
        report(v?.let { Units.distanceInputToMeters(it, units) })
    }

    Column(modifier) {
        OutlinedTextField(
            value = text,
            onValueChange = { text = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
            label = { Text("$label (${Units.distanceInputUnit(units)})") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth(),
        )
        arLength?.let { meters ->
            AssistChip(
                onClick = { text = String.format(Locale.US, "%.2f", Units.metersToDistanceInput(meters, units)) },
                label = { Text("Use AR length: ${Units.length(meters, units)}") },
            )
        }
    }
}
