<script setup lang="ts">
import { BOARD_EMOJIS, BOARD_ICON_NAMES, isIconName } from '#shared/constants/board-icons'
import { apiRoutes } from '~/routing'

const props = defineProps<{
  name: string
  image?: { workspaceId: string, boardId: string, url: string | null } | null
}>()
const emit = defineEmits<{ imageChanged: [] }>()
const color = defineModel<string>('color', { required: true })
const icon = defineModel<string | null>('icon', { default: null })
const dropImage = defineModel<boolean>('dropImage', { default: false })

type Kind = 'letter' | 'emoji' | 'icon' | 'image'
const KINDS = computed<{ value: Kind, label: string }[]>(() => [
  { value: 'letter', label: 'Буква' },
  { value: 'emoji', label: 'Эмодзи' },
  { value: 'icon', label: 'Иконка' },
  ...(props.image ? [{ value: 'image' as const, label: 'Картинка' }] : []),
])

const kind = ref<Kind>(props.image?.url ? 'image' : icon.value ? (isIconName(icon.value) ? 'icon' : 'emoji') : 'letter')

async function removeImage() {
  const fileId = fileIdFromUrl(props.image?.url)
  if (!props.image || !fileId) return
  await $fetch(`${apiRoutes.files(props.image.workspaceId)}/${fileId}`, { method: 'DELETE' })
}

function pickKind(k: Kind) {
  dropImage.value = k !== 'image' && !!props.image?.url
  kind.value = k
  if (k === 'letter') icon.value = null
}

const preview = computed(() => ({
  name: props.name || 'Доска',
  color: color.value,
  icon: icon.value,
  imageUrl: kind.value === 'image' ? props.image?.url ?? null : null,
}))
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-3">
      <BoardAvatar :board="preview" size="lg" />
      <div class="flex rounded-xl bg-elevated p-0.5 text-xs font-medium" role="radiogroup" aria-label="Вид аватарки">
        <button
          v-for="k in KINDS"
          :key="k.value"
          type="button"
          role="radio"
          :aria-checked="kind === k.value"
          :class="[
            'cursor-pointer rounded-[10px] px-3 py-1.5 transition-colors',
            kind === k.value ? 'bg-default text-highlighted shadow-sm' : 'text-muted hover:text-default',
          ]"
          @click="pickKind(k.value)"
        >
          {{ k.label }}
        </button>
      </div>
    </div>

    <FilesImageUploader
      v-if="kind === 'image' && image"
      :target="{ kind: 'board_image', workspaceId: image.workspaceId, boardId: image.boardId }"
      :current-url="image.url"
      :fallback="(name || 'Д').slice(0, 1).toUpperCase()"
      shape="rounded"
      :remove="removeImage"
      @changed="emit('imageChanged')"
    />

    <div v-else-if="kind !== 'letter'" class="grid grid-cols-8 gap-1 rounded-xl border border-default p-1.5">
      <template v-if="kind === 'emoji'">
        <button
          v-for="e in BOARD_EMOJIS"
          :key="e"
          type="button"
          :aria-pressed="icon === e"
          :class="['grid aspect-square cursor-pointer place-items-center rounded-lg text-lg transition-colors', icon === e ? 'bg-accented' : 'hover:bg-elevated']"
          @click="icon = e"
        >
          {{ e }}
        </button>
      </template>
      <template v-else>
        <button
          v-for="i in BOARD_ICON_NAMES"
          :key="i"
          type="button"
          :aria-label="i.replace('i-hugeicons-', '')"
          :aria-pressed="icon === i"
          :class="['grid aspect-square cursor-pointer place-items-center rounded-lg transition-colors', icon === i ? 'bg-accented text-highlighted' : 'text-muted hover:bg-elevated hover:text-default']"
          @click="icon = i"
        >
          <UIcon :name="i" class="size-4.5" />
        </button>
      </template>
    </div>

    <BoardColorPicker v-model="color" />
  </div>
</template>
