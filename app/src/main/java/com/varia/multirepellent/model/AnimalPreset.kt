package com.varia.multirepellent.model

/**
 * How solid the evidence is for a preset's claimed repellent effect.
 * None of these are backed by strong peer-reviewed studies; this
 * only distinguishes "commonly marketed, weakly disputed" from
 * "no credible mechanism at all".
 */
enum class EvidenceLevel {
    DISPUTED,
    NONE
}

data class AnimalPreset(
    val id: String,
    val displayName: String,
    val emoji: String,
    val minHz: Float,
    val maxHz: Float,
    val defaultHz: Float,
    val evidenceLevel: EvidenceLevel,
    val evidenceNote: String
)

object AnimalPresets {

    val mosquito = AnimalPreset(
        id = "mosquito",
        displayName = "Mosquito",
        emoji = "🦟",
        minHz = 15_000f,
        maxHz = 22_000f,
        defaultHz = 17_000f,
        evidenceLevel = EvidenceLevel.DISPUTED,
        evidenceNote = "Marketed anti-mosquito tones sit near a male mosquito's wingbeat pitch, " +
            "on the theory that it warns off mated females. Independent entomology trials have " +
            "found no reliable repellent effect. Treat this as a listening experiment, not pest control."
    )

    val lizard = AnimalPreset(
        id = "lizard",
        displayName = "Lizard",
        emoji = "🦎",
        minHz = 3_000f,
        maxHz = 8_000f,
        defaultHz = 5_000f,
        evidenceLevel = EvidenceLevel.NONE,
        evidenceNote = "House geckos and lizards hear roughly 50-8,000 Hz and show no known " +
            "sensitivity to ultrasound. There is no established repellent frequency for lizards - " +
            "this audible range reflects an unverified folk claim, included for completeness only."
    )

    val cat = AnimalPreset(
        id = "cat",
        displayName = "Cat",
        emoji = "🐈",
        minHz = 20_000f,
        maxHz = 25_000f,
        defaultHz = 22_000f,
        evidenceLevel = EvidenceLevel.DISPUTED,
        evidenceNote = "Cats hear up to roughly 64,000 Hz, higher than most household pets. " +
            "Commercial cat deterrents pair a burst of ultrasound with motion-triggered noise; " +
            "a lone continuous tone has weak, inconsistent evidence of keeping cats away."
    )

    val rat = AnimalPreset(
        id = "rat",
        displayName = "Rat",
        emoji = "🐀",
        minHz = 25_000f,
        maxHz = 45_000f,
        defaultHz = 30_000f,
        evidenceLevel = EvidenceLevel.DISPUTED,
        evidenceNote = "Rodents use ultrasound to communicate and can hear well past 45,000 Hz. " +
            "Plug-in ultrasonic pest repellers in this range are popular, but controlled trials " +
            "repeatedly show rats habituate and return within days."
    )

    val all = listOf(mosquito, lizard, cat, rat)
}
