<script setup lang="ts">
import { reactive, computed } from 'vue'
import { withBase } from 'vitepress'
import { works, type WorkItem } from './works'

const SPEED_OPTIONS = [1, 1.25, 1.5, 2, 2.5] as const

/** 较长视频默认用更高倍速 */
const DEFAULT_RATES: Record<string, number> = {
  'use-figma': 1.5,
  'wrong-book': 1.5,
  'ai-video': 2,
  'three-teach': 1.5,
}

const visibleWorks = computed(() => works.filter((w) => !w.hidden))

const rates = reactive<Record<string, number>>(
  Object.fromEntries(
    works
      .filter((w) => w.video)
      .map((w) => [w.id, DEFAULT_RATES[w.id] ?? 1])
  )
)

function assetUrl(path?: string) {
  if (!path) return undefined
  // OSS / 外链直链不要加站点 base
  if (/^https?:\/\//i.test(path)) return path
  return withBase(path)
}

function hasMedia(work: WorkItem) {
  return Boolean(work.video || work.cover)
}

function setRate(workId: string, rate: number, el?: HTMLVideoElement | null) {
  rates[workId] = rate
  if (el) el.playbackRate = rate
}

function onVideoReady(workId: string, e: Event) {
  const el = e.target as HTMLVideoElement
  el.playbackRate = rates[workId] ?? 1
}
</script>

<template>
  <div class="portfolio">
    <header class="portfolio__intro">
      <p class="portfolio__eyebrow">Portfolio</p>
      <h1 class="portfolio__title">作品集</h1>
      <p class="portfolio__lead">
        精选个人项目与实践作品。可点击在线预览或 GitHub 查看源码；有演示视频的作品可直接在本页播放，支持倍速。
      </p>
    </header>

    <ul class="portfolio__list">
      <li v-for="work in visibleWorks" :key="work.id" class="work">
        <div class="work__media-wrap" v-if="work.video">
          <div class="work__media">
            <video
              class="work__video"
              controls
              playsinline
              preload="metadata"
              :poster="assetUrl(work.cover)"
              @loadedmetadata="onVideoReady(work.id, $event)"
              @play="onVideoReady(work.id, $event)"
            >
              <source :src="assetUrl(work.video)" type="video/mp4" />
            </video>
          </div>
          <div class="work__speeds" role="group" :aria-label="`${work.title} 播放倍速`">
            <span class="work__speeds-label">倍速</span>
            <button
              v-for="rate in SPEED_OPTIONS"
              :key="rate"
              type="button"
              class="work__speed"
              :class="{ 'work__speed--active': rates[work.id] === rate }"
              @click="
                setRate(
                  work.id,
                  rate,
                  ($event.currentTarget as HTMLElement)
                    .closest('.work__media-wrap')
                    ?.querySelector('video') as HTMLVideoElement | null
                )
              "
            >
              {{ rate }}x
            </button>
          </div>
        </div>
        <div
          v-else
          class="work__media"
          :class="{ 'work__media--empty': !hasMedia(work) }"
        >
          <img
            v-if="work.cover"
            class="work__cover"
            :src="assetUrl(work.cover)"
            :alt="`${work.title} 截图`"
            loading="lazy"
          />
          <div v-else class="work__placeholder" aria-hidden="true">
            <span>{{ work.title.slice(0, 1) }}</span>
          </div>
        </div>

        <div class="work__body">
          <div class="work__meta">
            <h2 class="work__title">{{ work.title }}</h2>
            <ul v-if="work.tags?.length" class="work__tags">
              <li v-for="tag in work.tags" :key="tag">{{ tag }}</li>
            </ul>
          </div>

          <p class="work__summary">{{ work.summary }}</p>

          <ul v-if="work.highlights?.length" class="work__highlights">
            <li v-for="item in work.highlights" :key="item">{{ item }}</li>
          </ul>

          <div v-if="work.links?.length" class="work__links">
            <a
              v-for="link in work.links"
              :key="link.url"
              class="work__link"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ link.label }}
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.portfolio {
  max-width: 920px;
  margin: 0 auto;
  padding: 0.5rem 0 3rem;
}

.portfolio__intro {
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.portfolio__eyebrow {
  margin: 0 0 0.5rem;
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.portfolio__title {
  margin: 0 0 0.75rem;
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  line-height: 1.25;
  letter-spacing: -0.02em;
  border: none;
  padding: 0;
}

.portfolio__lead {
  margin: 0;
  max-width: 42rem;
  color: var(--vp-c-text-2);
  font-size: 1.05rem;
  line-height: 1.7;
}

.portfolio__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2.75rem;
}

.work {
  display: grid;
  gap: 1.25rem;
}

@media (min-width: 768px) {
  .work {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
    gap: 1.75rem;
    align-items: start;
  }
}

.work__media {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  aspect-ratio: 16 / 10;
  min-height: 180px;
}

.work__media-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
}

.work__cover,
.work__video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.work__video {
  background: #0b0d10;
  object-fit: contain;
}

.work__speeds {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.work__speeds-label {
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  margin-right: 0.15rem;
}

.work__speed {
  appearance: none;
  margin: 0;
  padding: 0.2rem 0.5rem;
  font-size: 0.75rem;
  line-height: 1.3;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.work__speed:hover {
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 40%, transparent);
  color: var(--vp-c-brand-1);
}

.work__speed--active {
  color: var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 12%, transparent);
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 40%, transparent);
  font-weight: 600;
}

.work__placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--vp-c-brand-1) 28%, transparent), transparent 55%),
    linear-gradient(145deg, var(--vp-c-bg-soft), var(--vp-c-bg-mute));
}

.work__placeholder span {
  font-size: 3rem;
  font-weight: 700;
  color: var(--vp-c-brand-1);
  opacity: 0.85;
}

.work__body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  min-width: 0;
}

.work__meta {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.work__title {
  margin: 0;
  font-size: 1.35rem;
  line-height: 1.35;
  border: none;
  padding: 0;
}

.work__tags {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.work__tags li {
  margin: 0;
  padding: 0.15rem 0.55rem;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
}

.work__summary {
  margin: 0;
  color: var(--vp-c-text-2);
  line-height: 1.7;
  font-size: 0.98rem;
}

.work__highlights {
  margin: 0;
  padding-left: 1.1rem;
  color: var(--vp-c-text-2);
  font-size: 0.92rem;
  line-height: 1.65;
}

.work__highlights li + li {
  margin-top: 0.2rem;
}

.work__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.25rem;
}

.work__link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 560;
  text-decoration: none;
  color: var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1) 28%, transparent);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.work__link:hover {
  background: color-mix(in srgb, var(--vp-c-brand-1) 18%, transparent);
  border-color: color-mix(in srgb, var(--vp-c-brand-1) 45%, transparent);
}
</style>
