package com.prism.music.data.foryou

import com.prism.music.AppContainer
import com.prism.music.data.ExplicitFilter
import com.prism.music.data.PrismList
import com.prism.music.data.imports.ImportKeys
import com.prism.music.data.innertube.SearchFilter
import com.prism.music.data.model.AlbumItem
import com.prism.music.data.model.ArtistItem
import com.prism.music.data.model.PlaylistItem
import com.prism.music.data.model.Song
import com.prism.music.data.model.SongItem
import java.time.LocalDate
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

internal class DiscoveryTools(private val c: AppContainer) {
    enum class Familiarity { FAMILIAR, BALANCED, DISCOVER }

    fun canRecommend(song: Song): Boolean =
        !song.isLocal && !song.isEpisode && !song.isLive && !song.isUpload &&
            !c.library.isDisliked(song.id) && !c.exclusions.blocks(song) && !c.exclusions.isSongExcluded(song.id) &&
            ExplicitFilter.plays(c.settings.current.behavior.explicitContent, song)

    suspend fun playlistSuggestions(playlist: PrismList): List<Song> = coroutineScope {
        val sources = c.forYou.sources()
        val seeds = playlist.songs.filter(::canRecommend).distinctBy { it.primaryArtist.lowercase() }
        val spread = seeds.filterIndexed { index, _ -> index % ((seeds.size + 4) / 5).coerceAtLeast(1) == 0 }.take(5)
        val queries = spread.map { seed -> async { available { sources.radio(seed).take(24) } } }
        val titleMatches = async { available { songSearch(playlist.title).take(20) } }
        val related = queries.awaitAll()
        val existing = playlist.songs.mapTo(hashSetOf(), LocalRadio::sameSong)
        val matches = titleMatches.await()
        val titleKeys = matches.mapTo(hashSetOf(), LocalRadio::sameSong)
        val votes = related.flatten().groupingBy(LocalRadio::sameSong).eachCount()
        val playlistArtists = playlist.songs.flatMap { it.artists }.mapTo(hashSetOf()) { it.name.lowercase() }
        fun sharedArtist(song: Song) = song.artists.any { it.name.lowercase() in playlistArtists }
        (related.flatten() + matches.filter { spread.isEmpty() || sharedArtist(it) })
            .filter { canRecommend(it) && LocalRadio.sameSong(it) !in existing }
            .distinctBy(LocalRadio::sameSong)
            .sortedByDescending { song ->
                val key = LocalRadio.sameSong(song)
                3 * (votes[key] ?: 0) + (if (key in titleKeys) 2 else 0) + (if (sharedArtist(song)) 2 else 0)
            }
            .take(30)
    }

    suspend fun artistRadio(artists: List<ArtistItem>, familiarity: Familiarity, recentAlbums: Boolean): List<Song> {
        val known = (c.db.songs().liked().map { it.toSong() } + c.library.recent.value)
            .mapTo(hashSetOf(), LocalRadio::sameSong)
        val stations = coroutineScope {
            artists.chunked(3).flatMap { batch ->
                batch.map { artist -> async { available { artistSongs(artist, recentAlbums) } } }.awaitAll()
            }
        }
        // Rotate through the selected artists so the first artist doesn't fill the station.
        val interleaved = interleave(stations).filter(::canRecommend).distinctBy(LocalRadio::sameSong)
        return when (familiarity) {
            Familiarity.BALANCED -> interleaved
            Familiarity.FAMILIAR -> interleaved.sortedByDescending { LocalRadio.sameSong(it) in known }
            Familiarity.DISCOVER -> interleaved.filterNot { LocalRadio.sameSong(it) in known }
        }.take(80)
    }

    private suspend fun artistSongs(artist: ArtistItem, recentAlbums: Boolean): List<Song> {
        val page = c.ytm.artist(artist.id)
        if (recentAlbums) {
            val newest = LocalDate.now().year - 1
            val releases = page.shelves.flatMap { it.items }.filterIsInstance<AlbumItem>().distinctBy { it.id }
                .mapNotNull { item -> year.find(item.subtitle)?.value?.toIntOrNull()?.let { it to item } }
                .filter { (released, _) -> released >= newest }
                .sortedByDescending { it.first }.take(3)
            return releases.flatMap { (_, release) -> available { c.ytm.album(release.id).songs } }
        }
        val radio = if (page.radioPlaylistId != null || page.radioVideoId != null) {
            available { c.radio(page.radioVideoId, page.radioPlaylistId, page.radioParams).songs }
        } else emptyList()
        return radio.ifEmpty { c.ytm.artistTopSongs(artist.id) }
    }

    suspend fun fromPrompt(query: String): List<Song> = coroutineScope {
        val direct = async { available { songSearch(query).take(25) } }
        val lists = available {
            c.ytm.search(query, SearchFilter.PLAYLISTS).items.filterIsInstance<PlaylistItem>().filterNot { it.isMix }.take(3)
        }
        val pages = lists.map { item -> async { available { c.ytm.playlistAll(item.id, limit = 18).songs } } }.awaitAll()
        interleave(listOf(direct.await()) + pages).filter(::canRecommend).distinctBy(LocalRadio::sameSong).take(35)
    }

    suspend fun personalPicks(newOnly: Boolean = false, draw: Int = 0, shown: Set<String> = emptySet()): List<Song> {
        val likes = c.db.songs().liked().map { it.toSong() }
        val lists = c.prismLibrary.lists.value.filterNot { c.exclusions.isPlaylistExcluded(it.id) }.flatMap { it.songs }
        return c.yourMusic.quickPicks(
            emptyList(), radioOf = { seed -> c.radio(seed.id, "RDAMVM${seed.id}").songs },
            libraryLikes = likes, playlistSongs = lists, relatedTo = { c.ytm.related(it.id, it.title) },
            discoveriesOnly = newOnly, draw = draw, shown = shown,
        ).filter(::canRecommend)
    }

    suspend fun videoFor(song: Song): String? {
        if (song.isVideo) return song.id
        c.queue.counterparts[song.id]?.let { return it }
        val candidates = c.ytm.search("${song.title} ${song.primaryArtist}", SearchFilter.VIDEOS).items.filterIsInstance<SongItem>()
        return candidates.firstOrNull { item ->
            val candidate = item.song
            ImportKeys.core(candidate.title) == ImportKeys.core(song.title) &&
                candidate.artists.any { a -> song.artists.any { it.name.equals(a.name, ignoreCase = true) } }
        }?.id
    }

    suspend fun songSearch(query: String): List<Song> =
        c.ytm.search(query, SearchFilter.SONGS).items.filterIsInstance<SongItem>().map { it.song }

    private fun interleave(lists: List<List<Song>>): List<Song> =
        (0 until (lists.maxOfOrNull { it.size } ?: 0)).flatMap { index -> lists.mapNotNull { it.getOrNull(index) } }

    companion object {
        private val year = Regex("""\b(?:19|20)\d{2}\b""")

        internal suspend fun <T> available(load: suspend () -> List<T>): List<T> = try {
            load()
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            emptyList()
        }
    }
}
