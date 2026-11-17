package com.prism.music.ui.screens

import android.view.TextureView
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.media3.common.AudioAttributes
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.ClippingMediaSource
import coil3.compose.AsyncImage
import com.prism.music.R
import com.prism.music.data.foryou.DiscoveryTools
import com.prism.music.data.model.Song
import com.prism.music.playback.PrismMediaSourceFactory
import com.prism.music.playback.VideoOnData
import com.prism.music.tr
import com.prism.music.ui.components.PrismButton
import com.prism.music.ui.components.PrismOutlinedButton
import com.prism.music.ui.components.PrismTextButton
import com.prism.music.ui.components.SubPage
import com.prism.music.ui.theme.LocalContainer
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

@Composable
internal fun SampleScreen(bottom: Dp, tabs: @Composable () -> Unit) {
    val c = LocalContainer.current
    val tools = remember(c) { DiscoveryTools(c) }
    var loaded by remember { mutableStateOf<List<Song>?>(null) }
    var failure by remember { mutableStateOf(false) }
    var attempt by remember { mutableStateOf(0) }
    LaunchedEffect(attempt) {
        loaded = null
        failure = false
        try {
            loaded = tools.personalPicks()
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            failure = true
        }
    }
    val songs = loaded.orEmpty()
    SubPage(tr(R.string.discovery_samples), bottom, horizontalPadding = 16.dp, spacing = 8.dp) {
        item { tabs() }
        if (songs.isEmpty()) item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(tr(when {
                    failure -> R.string.discovery_failed
                    loaded == null -> R.string.discovery_loading
                    else -> R.string.discovery_no_fresh
                }))
                if (failure || loaded != null) PrismOutlinedButton({ attempt++ }) { Text(tr(R.string.discovery_refresh)) }
            }
        } else item(key = "sample-player") { SamplePlayer(songs, tools) }
    }
}

@androidx.annotation.OptIn(UnstableApi::class)
@Composable
private fun SamplePlayer(songs: List<Song>, tools: DiscoveryTools) {
    val c = LocalContainer.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val scope = rememberCoroutineScope()
    val pager = rememberPagerState { songs.size }
    val song = songs[pager.settledPage.coerceIn(songs.indices)]
    val liked by c.library.likedIds.collectAsState()
    val factory = remember(c) { PrismMediaSourceFactory(c.playbackDataSourceFactory(), c.videoDataSourceFactory()) }
    val player = remember(c) { ExoPlayer.Builder(c.app).setAudioAttributes(AudioAttributes.DEFAULT, true).build() }
    var resumeSong by remember { mutableStateOf<String?>(null) }
    var enabled by remember { mutableStateOf(false) }
    var playing by remember { mutableStateOf(false) }
    var video by remember { mutableStateOf(false) }
    var audioOnly by remember(song.id) { mutableStateOf(false) }
    var failed by remember(song.id) { mutableStateOf(false) }
    var attempt by remember { mutableStateOf(0) }
    DisposableEffect(player, lifecycle) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) { playing = isPlaying }
            override fun onPlayerError(error: PlaybackException) {
                if (video) audioOnly = true else failed = true
            }
        }
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) { enabled = false; player.pause() }
        }
        player.addListener(listener)
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            player.release()
            val resume = resumeSong
            if (resume != null && c.player.currentSong.value?.id == resume) c.player.setPlaying(true)
        }
    }
    LaunchedEffect(song.id, enabled, audioOnly, attempt) {
        player.stop()
        video = false
        if (!enabled) return@LaunchedEffect
        val videoId = if (audioOnly || VideoOnData.off(c)) null else try {
            tools.videoFor(song)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) { null }
        val start = ((song.durationSec - 22).coerceAtLeast(0) / 4).coerceAtMost(42) * 1000L
        val end = if (song.durationSec > 0) minOf(song.durationSec * 1000L, start + 22_000) else 22_000L
        val media = MediaItem.Builder().setMediaId(song.id)
            .setUri("prism://audio/${song.id}" + (videoId?.let { "?video=$it" } ?: "")).build()
        video = videoId != null
        player.setMediaSource(ClippingMediaSource.Builder(factory.createMediaSource(media))
            .setStartPositionMs(start).setEndPositionMs(end).build())
        player.prepare()
        player.play()
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(tr(R.string.discovery_samples_detail), style = MaterialTheme.typography.bodyMedium)
        VerticalPager(pager, Modifier.fillMaxWidth().height(290.dp).clip(RoundedCornerShape(18.dp)), key = { songs[it].id }) { index ->
            Box(Modifier.fillMaxSize()) {
                AsyncImage(songs[index].thumbnail, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                if (index == pager.settledPage && video) AndroidView(
                    factory = { context -> TextureView(context).also(player::setVideoTextureView) },
                    onRelease = { player.clearVideoTextureView(it) },
                    modifier = Modifier.fillMaxSize(),
                    update = {},
                )
            }
        }
        Text(song.title, style = MaterialTheme.typography.titleLarge)
        Text(song.artistText, style = MaterialTheme.typography.bodyMedium)
        if (failed) Text(tr(R.string.discovery_preview_failed), color = MaterialTheme.colorScheme.error)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PrismButton(onClick = {
                if (playing) {
                    enabled = false
                    player.pause()
                } else {
                    if (c.player.isPlaying.value) {
                        resumeSong = c.player.currentSong.value?.id
                        c.player.setPlaying(false)
                    }
                    failed = false
                    enabled = true
                    attempt++
                }
            }) { Text(tr(if (playing) R.string.discovery_pause_preview else R.string.discovery_play_preview)) }
            PrismOutlinedButton(onClick = {
                resumeSong = null
                enabled = false
                player.pause()
                c.player.playSingle(song)
            }) { Text(tr(R.string.discovery_full_song)) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PrismTextButton({ c.library.toggleLike(song) }) {
                Text(tr(if (song.id in liked) R.string.discovery_sample_liked else R.string.discovery_sample_like))
            }
            PrismTextButton(onClick = {
                scope.launch { pager.animateScrollToPage((pager.settledPage + 1).coerceAtMost(songs.lastIndex)) }
            }, enabled = pager.settledPage < songs.lastIndex) { Text(tr(R.string.discovery_next_sample)) }
        }
    }
}
