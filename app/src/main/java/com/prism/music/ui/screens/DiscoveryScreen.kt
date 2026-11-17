package com.prism.music.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.prism.music.R
import com.prism.music.data.foryou.Discover
import com.prism.music.data.foryou.DiscoveryTools
import com.prism.music.data.imports.MatchResult
import com.prism.music.data.imports.MatchStatus
import com.prism.music.data.imports.TrackMatcher
import com.prism.music.data.innertube.SearchFilter
import com.prism.music.data.model.ArtistItem
import com.prism.music.data.model.PlaylistItem
import com.prism.music.data.model.Song
import com.prism.music.data.spotify.PublicSpotifyPlaylists
import com.prism.music.playback.QueueKind
import com.prism.music.playback.QueueSource
import com.prism.music.tr
import com.prism.music.ui.LocalNavigator
import com.prism.music.ui.Routes
import com.prism.music.ui.components.PrismButton
import com.prism.music.ui.components.PrismChip
import com.prism.music.ui.components.PrismOutlinedButton
import com.prism.music.ui.components.PrismTextButton
import com.prism.music.ui.components.PrismTextField
import com.prism.music.ui.components.SectionHeader
import com.prism.music.ui.components.SongRow
import com.prism.music.ui.components.SubPage
import com.prism.music.ui.theme.LocalContainer
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

private enum class DiscoveryTab(val key: String, val label: Int) {
    NEW("new", R.string.discovery_fresh),
    PLAYLISTS("playlists", R.string.playlists),
    RADIO("radio", R.string.discovery_radio),
    MIX("mix", R.string.discovery_prompt),
    SAMPLES("samples", R.string.discovery_samples),
}

@Composable
internal fun DiscoveryScreen(initialTab: String, spotifyLink: String?, bottomPadding: Dp) {
    var tab by rememberSaveable(initialTab, spotifyLink) {
        mutableStateOf(DiscoveryTab.entries.firstOrNull { it.key == initialTab } ?: DiscoveryTab.NEW)
    }
    val tabs: @Composable () -> Unit = {
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 12.dp)) {
            items(DiscoveryTab.entries) { entry ->
                PrismChip(tab == entry, { tab = entry }, tr(entry.label))
            }
        }
    }
    when (tab) {
        DiscoveryTab.NEW -> DiscoverTracks(bottomPadding, tabs)
        DiscoveryTab.PLAYLISTS -> DiscoverPlaylists(spotifyLink, bottomPadding, tabs)
        DiscoveryTab.RADIO -> ArtistRadio(bottomPadding, tabs)
        DiscoveryTab.MIX -> PromptMix(bottomPadding, tabs)
        DiscoveryTab.SAMPLES -> SampleScreen(bottomPadding, tabs)
    }
}

private class DiscoveryRequest(private val scope: CoroutineScope) {
    var busy by mutableStateOf(false)
        private set
    var error by mutableStateOf<Int?>(null)
        private set

    fun run(errorText: Int = R.string.discovery_failed, load: suspend () -> Unit) {
        if (busy) return
        busy = true
        error = null
        scope.launch {
            try {
                load()
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                error = errorText
            } finally {
                busy = false
            }
        }
    }
}

@Composable
private fun rememberDiscoveryRequest(): DiscoveryRequest {
    val scope = rememberCoroutineScope()
    return remember(scope) { DiscoveryRequest(scope) }
}

@Composable
private fun RequestStatus(request: DiscoveryRequest, progress: String? = null) {
    if (request.busy) Text(progress ?: tr(R.string.discovery_loading))
    request.error?.let { Text(tr(it), color = MaterialTheme.colorScheme.error) }
}

@Composable
private fun DiscoveryField(text: String, change: (String) -> Unit, label: Int, submit: () -> Unit) {
    val focus = LocalFocusManager.current
    PrismTextField(
        text, change, Modifier.fillMaxWidth(),
        label = { Text(tr(label)) }, singleLine = true,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { focus.clearFocus(); submit() }),
    )
}

@Composable
private fun DiscoverTracks(bottom: Dp, tabs: @Composable () -> Unit) {
    val c = LocalContainer.current
    val nav = LocalNavigator.current
    val tools = remember(c) { DiscoveryTools(c) }
    val request = rememberDiscoveryRequest()
    val weeklyRequest = rememberDiscoveryRequest()
    var songs by remember { mutableStateOf<List<Song>?>(null) }
    var draw by rememberSaveable { mutableStateOf(0) }
    val disliked by c.library.dislikedIds.collectAsState()
    fun refresh() = request.run {
        songs = tools.personalPicks(newOnly = true, draw = draw++, shown = songs.orEmpty().map { it.id }.toSet())
    }
    LaunchedEffect(Unit) { refresh() }
    val title = tr(R.string.discovery_fresh)
    val listed = songs.orEmpty().filterNot { it.id in disliked }
    SubPage(title, bottom, horizontalPadding = 16.dp, spacing = 8.dp) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                tabs()
                Text(tr(R.string.discovery_fresh_detail), style = MaterialTheme.typography.bodyMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PrismButton({ playDiscovery(c, title, listed) }, enabled = listed.isNotEmpty()) { Text(tr(R.string.discovery_play_all)) }
                    PrismOutlinedButton(::refresh, enabled = !request.busy) { Text(tr(R.string.discovery_refresh)) }
                }
                PrismTextButton(onClick = {
                    weeklyRequest.run(R.string.discovery_weekly_unavailable) {
                        c.discover.refresh(Discover.NEW)
                        if (c.forYou.mix(Discover.NEW) == null) error("Weekly mix unavailable")
                        nav.go(Routes.mix(Discover.NEW))
                    }
                }, enabled = !weeklyRequest.busy) { Text(tr(R.string.discovery_weekly)) }
                RequestStatus(request)
                RequestStatus(weeklyRequest)
                if (songs != null && listed.isEmpty() && !request.busy) Text(tr(R.string.discovery_no_fresh))
            }
        }
        items(listed, key = { it.id }) { song ->
            SongRow(song) { playDiscovery(c, title, listed, song) }
        }
    }
}

@Composable
private fun DiscoverPlaylists(initialLink: String?, bottom: Dp, tabs: @Composable () -> Unit) {
    val c = LocalContainer.current
    val nav = LocalNavigator.current
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    val focus = LocalFocusManager.current
    val tools = remember(c) { DiscoveryTools(c) }
    val search = rememberDiscoveryRequest()
    val fetch = rememberDiscoveryRequest()
    val match = rememberDiscoveryRequest()
    var query by rememberSaveable { mutableStateOf("") }
    var link by rememberSaveable(initialLink) { mutableStateOf(initialLink.orEmpty()) }
    var results by remember { mutableStateOf<List<PlaylistItem>?>(null) }
    var preview by remember { mutableStateOf<PublicSpotifyPlaylists.Playlist?>(null) }
    var matches by remember { mutableStateOf<List<MatchResult>?>(null) }
    var completed by remember { mutableStateOf(0) }
    var review by remember { mutableStateOf<Int?>(null) }
    val reviewed = remember { mutableStateMapOf<Int, Song>() }
    var openFailed by remember { mutableStateOf(false) }
    fun lookup() {
        val text = query.trim().take(150)
        if (text.isEmpty() || match.busy || fetch.busy) return
        focus.clearFocus()
        search.run {
            results = c.ytm.search(text, SearchFilter.PLAYLISTS).items.filterIsInstance<PlaylistItem>().filterNot { it.isMix }
        }
    }
    fun previewSpotify() {
        if (match.busy) return
        val url = PublicSpotifyPlaylists.linkIn(link) ?: return
        focus.clearFocus()
        fetch.run(R.string.discovery_spotify_unavailable) {
            preview = null
            matches = null
            reviewed.clear()
            preview = PublicSpotifyPlaylists.load(c.http, url)
        }
    }
    LaunchedEffect(initialLink) { if (initialLink != null) previewSpotify() }
    fun matchTracks(playlist: PublicSpotifyPlaylists.Playlist) = match.run {
        completed = 0
        val matcher = TrackMatcher(tools::songSearch)
        matches = coroutineScope {
            playlist.tracks.chunked(3).flatMap { batch ->
                batch.map { track ->
                    async {
                        DiscoveryTools.available { listOf(matcher.match(track)) }.firstOrNull()
                            ?: MatchResult(MatchStatus.NONE, null, emptyList())
                    }
                }.awaitAll().also { completed += it.size }
            }
        }
    }
    val current = preview
    val matched = matches
    val selected = matched.orEmpty().mapIndexedNotNull { index, result ->
        reviewed[index] ?: result.song?.takeIf { result.status == MatchStatus.SURE }
    }.distinctBy { it.id }
    SubPage(tr(R.string.discovery_find_playlists), bottom, horizontalPadding = 16.dp, spacing = 8.dp) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                tabs()
                DiscoveryField(query, { query = it }, R.string.discovery_playlist_query, ::lookup)
                PrismButton(::lookup, enabled = query.isNotBlank() && !search.busy) { Text(tr(R.string.discovery_search_youtube)) }
                PrismOutlinedButton(onClick = {
                    focus.clearFocus()
                    openFailed = runCatching { uri.openUri("https://open.spotify.com/search/${Uri.encode(query.trim().take(150))}/playlists") }.isFailure
                }, enabled = query.isNotBlank()) { Text(tr(R.string.discovery_search_spotify)) }
                if (openFailed) Text(tr(R.string.discovery_failed))
                RequestStatus(search)
                if (results?.isEmpty() == true && !search.busy) Text(tr(R.string.discovery_no_results))
            }
        }
        items(results.orEmpty().distinctBy { it.id }, key = { "public:${it.id}" }) { item ->
            DiscoveryRow(item.title, item.subtitle) { nav.go(Routes.playlist(item.id)) }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionHeader(tr(R.string.discovery_import_spotify))
                Text(tr(R.string.discovery_spotify_instructions), style = MaterialTheme.typography.bodyMedium)
                DiscoveryField(link, { link = it }, R.string.discovery_spotify_link, ::previewSpotify)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PrismOutlinedButton(onClick = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        val data: ClipData? = clipboard.primaryClip
                        data?.getItemAt(0)?.coerceToText(context)?.toString()?.let { link = it }
                    }, enabled = !match.busy && !fetch.busy) { Text(tr(R.string.discovery_paste)) }
                    PrismButton(::previewSpotify, enabled = PublicSpotifyPlaylists.linkIn(link) != null && !fetch.busy && !match.busy) {
                        Text(tr(R.string.discovery_preview_playlist))
                    }
                }
                RequestStatus(fetch)
                if (current != null) {
                    Text(current.title, style = MaterialTheme.typography.titleLarge)
                    Text(tr(R.string.discovery_spotify_exposed, current.tracks.size))
                    if (current.exposedCount >= 100) Text(tr(R.string.discovery_spotify_limit))
                    if (matched == null) PrismButton({ matchTracks(current) }, enabled = !match.busy && current.tracks.isNotEmpty()) {
                        Text(tr(R.string.discovery_match_tracks))
                    } else {
                        Text(tr(R.string.discovery_spotify_matches, selected.size, current.tracks.size))
                        PrismButton(onClick = {
                            val id = c.prismLibrary.create(current.title, selected)
                            nav.go(Routes.playlist(id))
                        }, enabled = selected.isNotEmpty()) { Text(tr(R.string.discovery_save_local)) }
                    }
                    RequestStatus(match, tr(R.string.discovery_matching, completed, current.tracks.size))
                }
            }
        }
        if (current != null && matched != null) items(matched.size, key = { "match:$it" }) { index ->
            val track = current.tracks[index]
            val result = matched[index]
            val selectedSong = reviewed[index] ?: result.song?.takeIf { result.status == MatchStatus.SURE }
            DiscoveryRow(track.title, selectedSong?.artistText ?: track.artist) {
                if (result.candidates.isNotEmpty()) review = index
            }
            if (selectedSong == null) Text(
                tr(if (result.candidates.isEmpty()) R.string.discovery_no_match else R.string.discovery_review_match),
                modifier = Modifier.padding(horizontal = 12.dp), style = MaterialTheme.typography.labelMedium,
            )
        }
    }
    review?.let { index ->
        val result = matched?.getOrNull(index)
        if (result != null && current != null) AlertDialog(
            onDismissRequest = { review = null },
            title = { Text(current.tracks[index].title) },
            text = {
                Column {
                    result.candidates.forEach { song -> DiscoveryRow(song.title, song.artistText) { reviewed[index] = song; review = null } }
                }
            },
            confirmButton = { PrismTextButton(onClick = { review = null }) { Text(tr(R.string.cancel)) } },
        )
    }
}

@Composable
private fun ArtistRadio(bottom: Dp, tabs: @Composable () -> Unit) {
    val c = LocalContainer.current
    val tools = remember(c) { DiscoveryTools(c) }
    val lookup = rememberDiscoveryRequest()
    val station = rememberDiscoveryRequest()
    val picked = remember { mutableStateMapOf<String, ArtistItem>() }
    var query by rememberSaveable { mutableStateOf("") }
    var results by remember { mutableStateOf<List<ArtistItem>?>(null) }
    var songs by remember { mutableStateOf<List<Song>?>(null) }
    var familiar by rememberSaveable { mutableStateOf(DiscoveryTools.Familiarity.BALANCED) }
    var releases by rememberSaveable { mutableStateOf(false) }
    val title = tr(R.string.discovery_radio)
    val choices = listOf(R.string.discovery_familiar, R.string.discovery_balanced, R.string.discovery_unheard)
    fun search() {
        val text = query.trim().take(150)
        if (text.isNotEmpty()) lookup.run {
            results = c.ytm.search(text, SearchFilter.ARTISTS).items.filterIsInstance<ArtistItem>().distinctBy { it.id }
        }
    }
    SubPage(title, bottom, horizontalPadding = 16.dp, spacing = 8.dp) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                tabs()
                Text(tr(R.string.discovery_radio_detail))
                DiscoveryField(query, { query = it }, R.string.discovery_artist_query, ::search)
                PrismOutlinedButton(::search, enabled = query.isNotBlank() && !lookup.busy) { Text(tr(R.string.search)) }
                RequestStatus(lookup)
                if (results?.isEmpty() == true) Text(tr(R.string.discovery_no_results))
            }
        }
        items(results.orEmpty(), key = { "artist:${it.id}" }) { artist ->
            val selected = artist.id in picked
            DiscoveryRow(artist.title, if (selected) tr(R.string.discovery_selected) else artist.subtitle) {
                if (selected) picked.remove(artist.id) else if (picked.size < 8) picked[artist.id] = artist
            }
        }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (picked.isNotEmpty()) LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(picked.values.sortedBy { it.title }, key = { it.id }) { artist ->
                        PrismChip(true, { picked.remove(artist.id) }, "${artist.title} ×")
                    }
                }
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(DiscoveryTools.Familiarity.entries) { mode ->
                        PrismChip(familiar == mode, { familiar = mode }, tr(choices[mode.ordinal]))
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { releases = !releases }) {
                    Checkbox(releases, onCheckedChange = null, modifier = Modifier.padding(8.dp))
                    Text(tr(R.string.discovery_recent_albums))
                }
                PrismButton(onClick = {
                    val artists = picked.values.sortedBy { it.title }
                    station.run { songs = tools.artistRadio(artists, familiar, releases) }
                }, enabled = picked.isNotEmpty() && !station.busy) { Text(tr(R.string.discovery_make_radio)) }
                RequestStatus(station)
                if (songs?.isEmpty() == true) Text(tr(R.string.discovery_no_results))
                if (!songs.isNullOrEmpty()) PrismOutlinedButton({ playDiscovery(c, title, songs.orEmpty()) }) { Text(tr(R.string.discovery_play_all)) }
            }
        }
        items(songs.orEmpty(), key = { "station:${it.id}" }) { song ->
            SongRow(song) { playDiscovery(c, title, songs.orEmpty(), song) }
        }
    }
}

@Composable
private fun PromptMix(bottom: Dp, tabs: @Composable () -> Unit) {
    val c = LocalContainer.current
    val nav = LocalNavigator.current
    val tools = remember(c) { DiscoveryTools(c) }
    val request = rememberDiscoveryRequest()
    val focus = LocalFocusManager.current
    var query by rememberSaveable { mutableStateOf("") }
    var mixName by rememberSaveable { mutableStateOf("") }
    var songs by remember { mutableStateOf<List<Song>?>(null) }
    fun make() {
        val text = query.trim().take(150)
        if (text.isEmpty()) return
        focus.clearFocus()
        request.run {
            songs = tools.fromPrompt(text)
            mixName = text
        }
    }
    SubPage(tr(R.string.discovery_prompt), bottom, horizontalPadding = 16.dp, spacing = 8.dp) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                tabs()
                Text(tr(R.string.discovery_prompt_detail))
                DiscoveryField(query, { query = it }, R.string.discovery_prompt_example, ::make)
                PrismButton(::make, enabled = query.isNotBlank() && !request.busy) { Text(tr(R.string.discovery_make_mix)) }
                RequestStatus(request)
                if (songs?.isEmpty() == true) Text(tr(R.string.discovery_no_results))
                if (!songs.isNullOrEmpty()) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PrismButton({ playDiscovery(c, mixName, songs.orEmpty()) }) { Text(tr(R.string.discovery_play_all)) }
                    PrismOutlinedButton(onClick = {
                        val id = c.prismLibrary.create(mixName, songs.orEmpty())
                        nav.go(Routes.playlist(id))
                    }) { Text(tr(R.string.discovery_save_local)) }
                }
            }
        }
        items(songs.orEmpty(), key = { it.id }) { song -> SongRow(song) { playDiscovery(c, mixName, songs.orEmpty(), song) } }
    }
}

@Composable
private fun DiscoveryRow(title: String, subtitle: String, click: () -> Unit) {
    Column(Modifier.fillMaxWidth().clickable(onClick = click).padding(horizontal = 12.dp, vertical = 10.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        if (subtitle.isNotBlank()) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

internal fun playDiscovery(c: com.prism.music.AppContainer, title: String, songs: List<Song>, start: Song? = null) =
    c.player.playQueue(songs, songs.indexOfFirst { it.id == start?.id }.coerceAtLeast(0), QueueSource(QueueKind.OTHER, title))
