<script lang="ts">
  import cx from "classnames"
  import {last, ellipsize, postJson} from "@welshman/lib"
  import {Tags} from "@welshman/util"
  import Audio from "src/partials/Audio.svelte"
  import Image from "src/partials/Image.svelte"
  import Anchor from "src/partials/Anchor.svelte"
  import Spinner from "src/partials/Spinner.svelte"
  import {dufflepud, imgproxy} from "src/engine"

  export let url
  export let imeta = Tags.wrap([["url", url]])
  export let onClick = null
  export let onClose = null
  export let fullSize = false

  const loadPreview = async () => {
    const json = await postJson(dufflepud("link/preview"), {url})

    if (!json?.title && !json?.image) {
      throw new Error("Failed to load link preview")
    }

    return json
  }
</script>

<span>
  {#if url.match(/\.(wav|mp3|m3u8)$/)}
    {#await import("src/util/audio")}
      <span />
    {:then { AudioController }}
      <Audio controller={new AudioController(url)} />
    {/await}
  {:else}
    <Anchor
      external
      type="unstyled"
      href={onClick ? null : url}
      on:click={onClick}
      style="background-color: rgba(15, 15, 14, 0.5)"
      class="relative flex w-full flex-grow flex-col overflow-hidden rounded-xl">
      {#if url.match(/open.spotify.com/)}
        {@const id = last(url.split("?")[0].match(/[a-z]+\/[0-9A-z]+$/))}
        {@const src = `https://open.spotify.com/embed/${id}`}
        <iframe
          {src}
          allowfullscreen
          style="border-radius:12px"
          width="100%"
          height="352"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy" />
      {:else if url.match(/tidal.com/)}
        {@const {pathname} = new URL(url)}
        {@const id = last(pathname.split('/'))}
        {@const name = pathname.includes('album') ? 'albums' : 'tracks'}
        {@const src = `https://embed.tidal.com/${name}/${id}`}
        <iframe
          {src}
          allowfullscreen
          style="border-radius:12px"
          width="100%"
          height="100%"
          scrolling="no"
          frameBorder="0"
          allow="encrypted-media"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          title="TIDAL Embed Player"
          loading="lazy" />
      {:else if url.match(/\.(mov|webm|mp4)$/)}
        <video controls src={url} class="max-h-96 object-contain object-center" />
      {:else if url.match(/\.(jpe?g|png|gif|webp)$/)}
        <Image
          alt="Link preview"
          src={imeta
            .whereKey("url")
            .values()
            .valueOf()
            .map(url => imgproxy(url))}
          class={cx("object-contain object-center", {"max-h-96": !fullSize})} />
      {:else}
        {#await loadPreview()}
          <Spinner />
        {:then { title, description, image }}
          {#if image}
            <img
              alt="Link preview"
              src={imgproxy(image)}
              class="max-h-96 object-contain object-center" />
          {/if}
          <div class="h-px bg-neutral-600" />
          {#if title}
            <div class="flex flex-col bg-white px-4 py-2 text-black">
              <strong class="overflow-hidden text-ellipsis whitespace-nowrap">{title}</strong>
              <small>{ellipsize(description, 140)}</small>
            </div>
          {/if}
        {:catch}
          <p class="mb-1 p-12 text-center text-neutral-600">
            Unable to load a preview for {url}
          </p>
        {/await}
      {/if}
      {#if onClose}
        <div
          on:click|preventDefault={onClose}
          class="absolute right-0 top-0 m-1 flex h-6 w-6 cursor-pointer items-center justify-center
           rounded-full border border-solid border-neutral-600 bg-white text-black opacity-50 shadow">
          <i class="fa fa-times" />
        </div>
      {/if}
    </Anchor>
  {/if}
</span>
