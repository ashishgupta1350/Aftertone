package com.prism.music.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.prism.music.R
import com.prism.music.data.foryou.DiscoveryTools
import com.prism.music.data.foryou.LocalRadio
import com.prism.music.data.model.Song
import com.prism.music.tr
import com.prism.music.ui.components.PrismOutlinedButton
import com.prism.music.ui.components.SheetItem
import com.prism.music.ui.components.SongRow
import com.prism.music.ui.components.SubPage
import com.prism.music.ui.theme.LocalContainer
import com.prism.music.ui.theme.PrismIcons
import kotlinx.coroutines.CancellationException

@Composable
internal fun PlaylistSuggestionsScreen(id: String, bottomPadding: Dp) {
    val c = LocalContainer.current
    val lists by c.prismLibrary.lists.collectAsState()
    val disliked by c.library.dislikedIds.collectAsState()
    val playlist = lists.firstOrNull { it.id == id && it.smart == null }
    val tools = remember(c) { DiscoveryTools(c) }
    var songs by remember(id) { mutableStateOf<List<Song>>(emptyList()) }
    var busy by remember(id) { mutableStateOf(true) }
    var failed by remember(id) { mutableStateOf(false) }
    var refresh by remember(id) { mutableStateOf(0) }
    LaunchedEffect(id, refresh, playlist != null) {
        val list = playlist ?: return@LaunchedEffect
        busy = true
        failed = false
        try {
            songs = tools.playlistSuggestions(list)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            failed = true
        } finally {
            busy = false
        }
    }
    val existing = remember(playlist) { playlist?.songs.orEmpty().mapTo(hashSetOf(), LocalRadio::sameSong) }
    val available = songs.filter { LocalRadio.sameSong(it) !in existing && it.id !in disliked }
    val title = tr(R.string.discovery_playlist_suggestions)
    SubPage(title, bottomPadding, subtitle = playlist?.title) {
        item {
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                when {
                    playlist == null -> Text(tr(R.string.discovery_playlist_unavailable))
                    busy -> Text(tr(R.string.discovery_loading))
                    failed -> Text(tr(R.string.discovery_failed))
                    available.isEmpty() -> Text(tr(R.string.discovery_no_results))
                }
                if (playlist != null) PrismOutlinedButton({ refresh++ }, enabled = !busy) { Text(tr(R.string.discovery_refresh)) }
            }
        }
        if (playlist != null) items(available, key = { it.id }) { song ->
            SongRow(
                song,
                extraActions = listOf(SheetItem(PrismIcons.PlaylistAdd, tr(R.string.discovery_add_to_this_playlist)) {
                    c.prismLibrary.add(id, listOf(song))
                }),
            ) { c.player.playSingle(song) }
            PrismOutlinedButton(
                onClick = { c.prismLibrary.add(id, listOf(song)) },
                modifier = Modifier.padding(start = 16.dp, bottom = 8.dp),
            ) { Text(tr(R.string.discovery_add_to_this_playlist)) }
        }
    }
}
