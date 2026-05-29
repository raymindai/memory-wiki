/*
 * Hilt EntryPoint so non-Hilt callers (Composables that don't
 * get a ViewModel) can pull the singleton Markwon out of the
 * application graph.
 */

package wiki.memory.memorywiki.di

import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.noties.markwon.Markwon

@EntryPoint
@InstallIn(SingletonComponent::class)
interface MarkwonEntryPoint {
    fun markwon(): Markwon
}
