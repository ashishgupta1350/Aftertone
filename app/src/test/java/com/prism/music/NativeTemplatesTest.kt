package com.prism.music

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.IconButton
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.test.*
import androidx.compose.ui.unit.dp
import androidx.core.graphics.ColorUtils
import com.prism.music.data.prefs.*
import com.prism.music.ui.screens.settings.TemplatePicker
import com.prism.music.ui.player.CupidPlayer
import com.prism.music.data.model.Song
import com.prism.music.data.model.ArtistRef
import com.prism.music.playback.toMediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.common.Player
import com.prism.music.ui.theme.*
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], application = android.app.Application::class, qualifiers = "w320dp-h840dp-xhdpi")
class NativeTemplatesTest : ThemeLooksPageHarness() {
    @Test fun nativeCupidPlayerFits320dpAndModeKeepsTheRealSongAndPosition() {
        container.settings.setAppTemplate(AppTemplate.CUPID)
        container.settings.setThemeMode(ThemeMode.LIGHT)
        await { stored.appTemplate == AppTemplate.CUPID && stored.themeMode == ThemeMode.LIGHT }
        val player = ExoPlayer.Builder(org.robolectric.RuntimeEnvironment.getApplication()).build()
        container.player.testPlayer = player
        try {
            val song = Song("local:cupid-test", "Lovers Rock", listOf(ArtistRef("TV Girl")), durationSec = 213)
            player.setMediaItem(song.toMediaItem())
            player.seekTo(51_000)
            container.player.onTimelineChanged(player.currentTimeline, Player.TIMELINE_CHANGE_REASON_PLAYLIST_CHANGED)
            var queued = false
            show { CupidPlayer({}, {}, {}, { queued = true }, {}, {}) }
            compose.onNodeWithText("Lovers Rock").assertIsDisplayed()
            compose.onNodeWithTag("cupid:Play").assertIsDisplayed().assertHeightIsAtLeast(48.dp)
            compose.onNodeWithTag("cupid:seek").assertIsDisplayed()
            compose.onNodeWithContentDescription("Settings").assertIsDisplayed()
            save("native-templates", "cupid-player-light-320")
            compose.onNodeWithTag("cupid:mode").performClick()
            await { stored.themeMode == ThemeMode.DARK }
            assertEquals(song.id, container.player.currentSong.value?.id)
            assertEquals(51_000L, player.currentPosition)
            compose.onNodeWithText("Lovers Rock").assertIsDisplayed()
            compose.onNodeWithContentDescription("Queue").performClick()
            assertTrue(queued)
            save("native-templates", "cupid-player-dark-320")
        } finally {
            container.player.testPlayer = null
            player.release()
        }
    }

    @Test fun selectingTemplateAndDarkModePersistsWithoutChangingLibraryOrAccountPreferences() {
        show { TemplatePicker() }
        compose.onNodeWithTag("template:CUPID").performClick()
        await { stored.appTemplate == AppTemplate.CUPID }
        compose.onNodeWithTag("template-mode:DARK").performClick()
        await { stored.themeMode == ThemeMode.DARK }
        assertEquals(AppTemplate.CUPID, container.settings.current.appTemplate)
        assertEquals(AppSettings().libraryView, stored.libraryView)
        assertEquals(AppSettings().cookie, stored.cookie)
        assertEquals('s', container.settings.lookKinds["app_template"])
        save("native-templates", "cupid-picker-dark-320")
    }

    @Test fun originalRestoresStoredLayoutRatherThanPrototypeDefaults() {
        val original = AppSettings(appTemplate = AppTemplate.CUPID, navTabs = listOf(NavTab.HOME, NavTab.REPLAY), fontChoice = FontChoice.SERIF)
        val native = original.withTemplate()
        assertEquals(listOf(NavTab.HOME, NavTab.SEARCH, NavTab.LIBRARY), native.navTabs)
        assertEquals(FontChoice.MONO, native.fontChoice)
        val restored = original.copy(appTemplate = AppTemplate.ORIGINAL).withTemplate()
        assertEquals(original.navTabs, restored.navTabs)
        assertEquals(FontChoice.SERIF, restored.fontChoice)
        assertEquals(original.behavior, native.behavior)
        assertEquals(original.cookie, native.cookie)
        assertEquals(original.libraryView, native.libraryView)
    }

    @Test fun paperAndGlassInkHaveReadableContrastInBothModes() {
        listOf(AppTemplate.AURORA, AppTemplate.ROSEMARY, AppTemplate.CUPID).forEach { template ->
            listOf(false, true).forEach { dark ->
                val colors = templateColors(AppSettings(appTemplate = template), dark).scheme
                fun contrast(ink: Color, surface: Color) = ColorUtils.calculateContrast(ink.toArgb(), surface.toArgb())
                assertTrue("$template/$dark body", contrast(colors.onBackground, colors.background) >= 4.5)
                assertTrue("$template/$dark secondary", contrast(colors.onSurfaceVariant, colors.surface) >= 4.5)
                assertTrue("$template/$dark controls", contrast(colors.primary, colors.background) >= 3)
            }
        }
    }

    @Test fun narrowHeaderKeepsTitleAnd48dpModeButtonWithManyActions() {
        container.settings.setAppTemplate(AppTemplate.CUPID)
        await { stored.appTemplate == AppTemplate.CUPID }
        show {
            TemplateHeader("Your library") {
                repeat(6) { index -> IconButton({}, Modifier.size(48.dp)) { TemplateIcon(PrismIcons.Settings, "Action $index", Modifier.size(24.dp)) } }
            }
        }
        compose.onNodeWithText("Your library").assertIsDisplayed()
        val mode = compose.onNodeWithContentDescription("Switch to dark mode")
        mode.assertWidthIsAtLeast(48.dp).assertHeightIsAtLeast(48.dp)
        mode.performClick()
        await { stored.themeMode == ThemeMode.DARK }
        compose.onNodeWithContentDescription("Switch to light mode").assertIsDisplayed()
        save("native-templates", "cupid-header-320")
    }

    @Test fun everyNativeFunctionCanUseThePixelIconAdapter() {
        PrismIconData.names.forEach { name ->
            val original = PrismIcons.preview(name, IconFill.OUTLINE, IconPack.PRISM)
            val icon = CupidNativeIcons.of(original)
            assertTrue("$name has a native pixel drawing", icon.name.startsWith("Cupid"))
            assertTrue("$name viewport", icon.viewportWidth > 0f && icon.viewportHeight > 0f)
        }
    }
}
