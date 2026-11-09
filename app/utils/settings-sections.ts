import type { MeSection, WorkspaceSection } from '~/routing'

export type SectionMeta = { label: string, icon: string, description: string }

export const ME_SECTION_META: Record<MeSection, SectionMeta> = {
  profile: { label: 'Профиль', icon: 'i-hugeicons-user', description: 'Как вас видят коллеги: имя, фото и пара слов о себе в карточках и задачах.' },
  security: { label: 'Безопасность', icon: 'i-hugeicons-lock-password', description: 'Пароль и устройства, с которых вы входили. Выйдите там, где больше не работаете.' },
  notifications: { label: 'Уведомления', icon: 'i-hugeicons-notification-02', description: 'Что и куда присылать: колокольчик, почта, Пачка и утренний дайджест.' },
  appearance: { label: 'Внешний вид', icon: 'i-hugeicons-paint-board', description: 'Тема и плотность интерфейса. Всё применяется сразу.' },
  work: { label: 'Работа', icon: 'i-hugeicons-keyboard', description: 'С какой страницы начинать день, горячие клавиши и обучающие подсказки.' },
  account: { label: 'Аккаунт', icon: 'i-hugeicons-user-circle', description: 'Выход и удаление аккаунта со всем, что к нему привязано.' },
}

export const WORKSPACE_SECTION_META: Record<WorkspaceSection, SectionMeta> = {
  general: { label: 'Общее', icon: 'i-hugeicons-settings-02', description: 'Название, логотип и то, как воркспейс выглядит в списке.' },
  storage: { label: 'Хранилище', icon: 'i-hugeicons-hard-drive', description: 'Сколько места занимают файлы команды и что его съедает.' },
  integrations: { label: 'Интеграции', icon: 'i-hugeicons-plug-socket', description: 'Связь Такта с сервисами, где уже живёт команда.' },
  boards: { label: 'Новые доски', icon: 'i-hugeicons-dashboard-square-add', description: 'Значения, с которыми создаётся каждая новая доска.' },
  delete: { label: 'Удаление', icon: 'i-hugeicons-delete-02', description: 'Удалить воркспейс целиком. Вернуть его не получится.' },
}
