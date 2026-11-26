package com.prism.music.data.prefs

/** Native versions of the reviewed Android prototypes. The original remains available. */
enum class AppTemplate(val title: String, val description: String) {
    ORIGINAL("Original", "Your existing Prism layout and appearance"),
    AURORA("Aurora Glass", "Soft lavender, glowing glass and spacious artwork"),
    ROSEMARY("Rosemary Glass", "Deep violet, glossy icons and floating panels"),
    CUPID("Cupid Player", "Rose paper, pixel icons and a moonlit record player");
}

/** Presentation defaults only; stored preferences and playback data are never rewritten. */
fun AppSettings.withTemplate(): AppSettings = when (appTemplate) {
    AppTemplate.ORIGINAL -> this
    else -> copy(
        colorSource = ColorSource.CUSTOM,
        accent = if (appTemplate == AppTemplate.CUPID) 0xFFA34769.toInt() else 0xFFB69AF1.toInt(),
        pageColors = false,
        lightStyle = LightStyle.WHITE,
        pureBlack = false,
        frostedGlass = appTemplate != AppTemplate.CUPID,
        liquidGlass = false,
        frostedPages = appTemplate != AppTemplate.CUPID,
        fontChoice = if (appTemplate == AppTemplate.CUPID) FontChoice.MONO else FontChoice.CLEAN,
        corners = if (appTemplate == AppTemplate.CUPID) Corners.SHARP else Corners.ROUND,
        shapes = if (appTemplate == AppTemplate.CUPID) shapes.copy(button = ButtonShape.SQUARE, cornerScale = 0.25f) else shapes,
        navTabs = listOf(NavTab.HOME, NavTab.SEARCH, NavTab.LIBRARY),
        navStyle = NavBarStyle.DOCKED,
        navLabels = NavLabels.ALWAYS,
        navHideOnScroll = false,
        miniPlayerStyle = MiniPlayerStyle.CARD,
        playerShuffleRepeat = true,
        searchChips = listOf("SONGS", "PHONE"),
        homeHeader = HomeHeader.GREETING,
    )
}
