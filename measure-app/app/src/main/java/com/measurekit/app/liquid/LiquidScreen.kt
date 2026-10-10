package com.measurekit.app.liquid

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.measurekit.app.units.UnitSystem
import com.measurekit.app.units.Units
import java.util.Locale

private enum class Shape(val label: String, val fields: List<Pair<String, String>>) {
    CYLINDER("Bottle / can", listOf("d" to "Diameter", "h" to "Container height", "fill" to "Liquid height")),
    BOX("Box / tank", listOf("l" to "Length", "w" to "Width", "h" to "Container height", "fill" to "Liquid height")),
    CUP("Cup / bucket", listOf("d1" to "Bottom diameter", "d2" to "Top diameter", "h" to "Container height", "fill" to "Liquid height")),
    HORIZONTAL("Horizontal tank", listOf("d" to "Diameter", "l" to "Length", "fill" to "Liquid depth")),
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LiquidScreen(units: UnitSystem, modifier: Modifier = Modifier) {
    var shape by remember { mutableStateOf(Shape.CYLINDER) }
    val inputs = remember { mutableStateMapOf<String, String>() }
    val unit = Units.inputLengthUnit(units)

    fun value(key: String): Double? =
        inputs[key]?.replace(',', '.')?.toDoubleOrNull()?.takeIf { it >= 0 }?.let { Units.inputToMeters(it, units) }

    val container: Container? = when (shape) {
        Shape.CYLINDER -> ifAll(value("d"), value("h")) { (d, h) -> Container.Cylinder(d, h) }
        Shape.BOX -> ifAll(value("l"), value("w"), value("h")) { (l, w, h) -> Container.Box(l, w, h) }
        Shape.CUP -> ifAll(value("d1"), value("d2"), value("h")) { (a, b, h) -> Container.Frustum(a, b, h) }
        Shape.HORIZONTAL -> ifAll(value("d"), value("l")) { (d, l) -> Container.HorizontalCylinder(d, l) }
    }
    val fill = value("fill")

    Column(
        modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Liquid volume", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Pick the container shape and enter its inner dimensions and the liquid level. " +
                "Tip: measure them with the Length or Size tab.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Shape.entries.forEach { s ->
                FilterChip(selected = s == shape, onClick = { shape = s }, label = { Text(s.label) })
            }
        }
        shape.fields.forEach { (key, label) ->
            OutlinedTextField(
                value = inputs[key].orEmpty(),
                onValueChange = { inputs[key] = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                label = { Text("$label ($unit)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (container == null) {
                    Text("Enter the container dimensions to see results.")
                } else {
                    val liquid = fill?.let(container::liquidVolume)
                    Text(
                        liquid?.let { Units.liquidVolume(it, units) } ?: "—",
                        style = MaterialTheme.typography.displaySmall,
                    )
                    Text("Capacity: ${Units.liquidVolume(container.capacity, units)}")
                    if (fill != null) {
                        val fraction = container.fillFraction(fill)
                        LinearProgressIndicator(progress = { fraction.toFloat() }, modifier = Modifier.fillMaxWidth())
                        Text(String.format(Locale.US, "%.0f%% full", fraction * 100))
                    }
                }
            }
        }
    }
}

private inline fun <T> ifAll(vararg values: Double?, build: (List<Double>) -> T): T? =
    if (values.all { it != null && it > 0 }) build(values.map { it!! }) else null
